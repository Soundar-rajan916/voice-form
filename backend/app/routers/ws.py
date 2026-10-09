import time
import json
import asyncio
from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import AsyncSessionLocal
from app.models import Submission, FormVersion, FormField, SubmissionAnswer, SubmissionProposal
from app.security import decode_access_token
from app.services.session import FormSessionManager, session_manager
from app.services.stt import transcribe_audio_wav
from app.services.extraction import extract_answer
from app.services.validation import validate_rule, fast_path_validate
from app.services.navigation import parse_navigation_command
from app.services.normalizer import normalize_transcript
from app.services.grounding import verify_grounding
from app.services.filters import check_echo_guard, check_hallucination_filter

router = APIRouter(prefix="/ws", tags=["websocket"])

ACCEPT_ALL_PATTERNS = [
    "accept all", "accept proposals", "accept all proposals", "accept everything",
    "accept all document suggestions", "accept document proposals",
    "எல்லாவற்றையும் ஏற்றுக்கொள்", "அனைத்தையும் ஏற்றுக்கொள்", "முன்மொழிவுகளை ஏற்றுக்கொள்"
]

def is_accept_all_command(text: str) -> bool:
    t_lower = text.strip().lower()
    return any(pattern in t_lower for pattern in ACCEPT_ALL_PATTERNS)


@router.websocket("/submissions/{submission_id}")
async def websocket_submission_endpoint(websocket: WebSocket, submission_id: int):
    await websocket.accept()

    session: FormSessionManager = None
    user_id: int = None
    user_role: str = None

    # Step 1: Wait for Auth Message
    try:
        auth_msg_raw = await asyncio.wait_for(websocket.receive_text(), timeout=10.0)
        auth_data = json.loads(auth_msg_raw)
        if auth_data.get("type") != "auth" or not auth_data.get("token"):
            await websocket.send_json({"type": "error", "message": "First message must be auth with token"})
            await websocket.close(code=4001)
            return

        token = auth_data["token"]
        payload = decode_access_token(token)
        if not payload or not payload.get("sub"):
            await websocket.send_json({"type": "error", "message": "Invalid authentication token"})
            await websocket.close(code=4001)
            return

        user_id = int(payload["sub"])
        user_role = payload.get("role", "user")

    except Exception as e:
        print(f"[WS Auth Error] Submission {submission_id}: {e}")
        try:
            await websocket.send_json({"type": "error", "message": "Authentication timeout or format error"})
            await websocket.close(code=4001)
        except Exception:
            pass
        return

    # Step 2: Load Submission and Version schema
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(Submission)
            .options(
                selectinload(Submission.version).selectinload(FormVersion.fields),
                selectinload(Submission.answers),
                selectinload(Submission.proposals)
            )
            .where(Submission.id == submission_id)
        )
        submission = res.scalar_one_or_none()
        if not submission or (submission.user_id != user_id and user_role != "admin"):
            try:
                await websocket.send_json({"type": "error", "message": "Submission not found"})
                await websocket.close(code=4004)
            except Exception:
                pass
            return

        session = session_manager.get_session(submission_id)
        if not session:
            session = FormSessionManager(submission, submission.version)
            session_manager.register_session(submission_id, session)

        if websocket not in session.websockets:
            session.websockets.append(websocket)

    # Send Initial Ready Event
    fields_payload = [
        {
            "id": f.id,
            "field_name": f.field_name,
            "data_type": f.data_type,
            "description": f.description,
            "required": f.required,
            "position": f.position,
            "choices": f.choices,
            "question_en": f.question_en,
            "question_ta": f.question_ta
        }
        for f in session.fields
    ]

    ready_state = session.build_state_dict()
    ready_state.update({
        "type": "ready",
        "submission_id": submission_id,
        "fields": fields_payload,
        "answers": session.answers,
        "proposals": list(session.proposals.values())
    })
    await websocket.send_json(ready_state)

    # Step 3: Realtime Voice & Control Loop
    try:
        while True:
            message = await websocket.receive()
            if message.get("type") == "websocket.disconnect":
                break
            start_turn_time = time.time()

            # Handle JSON Control Commands
            if "text" in message and message["text"]:
                try:
                    text_data = json.loads(message["text"])
                    msg_type = text_data.get("type")
                    turn_num = text_data.get("turn_number")

                    # Idempotency Check
                    if turn_num is not None and turn_num <= session.last_processed_turn_number:
                        st_msg = session.build_state_dict()
                        st_msg.update({"type": "state_sync"})
                        await websocket.send_json(st_msg)
                        continue

                    if msg_type in ["goto", "back", "undo", "cancel_edit", "text_input", "reset_mic", "submit", "accept_proposals", "dismiss_proposal", "edit_proposal"]:
                        if session.is_locked():
                            await websocket.send_json({
                                "type": "error",
                                "message": "This form has already been submitted"
                            })
                            continue

                    # Proposal Control Actions
                    if msg_type == "accept_proposals":
                        prop_ids = text_data.get("proposal_ids")
                        async with AsyncSessionLocal() as db:
                            accepted = await session_manager.accept_proposals(submission_id, prop_ids, db)
                        bot_txt = "Accepted document proposals."
                        session.add_bot_message(bot_txt)
                        nav_msg = session.build_state_dict()
                        nav_msg.update({"type": "navigate", "text": bot_txt})
                        await websocket.send_json(nav_msg)
                        continue

                    elif msg_type == "dismiss_proposal":
                        pid = text_data.get("proposal_id")
                        if pid:
                            async with AsyncSessionLocal() as db:
                                await session_manager.dismiss_proposal(submission_id, pid, db)
                        nav_msg = session.build_state_dict()
                        nav_msg.update({"type": "navigate"})
                        await websocket.send_json(nav_msg)
                        continue

                    elif msg_type == "edit_proposal":
                        pid = text_data.get("proposal_id")
                        new_val = text_data.get("new_value")
                        if pid and new_val:
                            async with AsyncSessionLocal() as db:
                                await session_manager.edit_proposal(submission_id, pid, new_val, db)
                        nav_msg = session.build_state_dict()
                        nav_msg.update({"type": "navigate"})
                        await websocket.send_json(nav_msg)
                        continue

                    if msg_type == "reset_mic":
                        session.reset_retries()
                        res_msg = session.build_state_dict()
                        res_msg.update({"type": "mic_resumed"})
                        await websocket.send_json(res_msg)
                        continue

                    if msg_type == "submit":
                        missing_fields = [
                            f.field_name.replace("_", " ") for f in session.fields
                            if f.required and (f.id not in session.answers or not session.answers[f.id].get("value"))
                        ]
                        if missing_fields:
                            await websocket.send_json({
                                "type": "error",
                                "message": f"Cannot submit form: missing required fields: {', '.join(missing_fields)}"
                            })
                            continue

                        session.mode = "normal"
                        session.editing_field_id = None
                        session.submission_status = "submitted"

                        async with AsyncSessionLocal() as db:
                            res = await db.execute(select(Submission).where(Submission.id == submission_id))
                            sub = res.scalar_one_or_none()
                            if sub:
                                sub.status = "submitted"
                                sub.submitted_at = datetime.utcnow()
                                sub.completed_at = datetime.utcnow()
                                await db.commit()

                        sub_msg = session.build_state_dict()
                        sub_msg.update({
                            "type": "submitted",
                            "message": "🎉 Form successfully submitted!"
                        })
                        await websocket.send_json(sub_msg)
                        continue

                    if msg_type == "goto":
                        target_id = text_data.get("field_id")
                        if target_id and session.goto(target_id):
                            tf = session.get_field_by_id(target_id)
                            friendly_name = session.get_friendly_field_name(tf)
                            bot_txt = f"Okay, let's redo your {friendly_name}."
                            session.add_bot_message(bot_txt)
                            nav_msg = session.build_state_dict()
                            nav_msg.update({
                                "type": "navigate",
                                "text": bot_txt
                            })
                            await websocket.send_json(nav_msg)
                        continue

                    elif msg_type == "back":
                        if session.go_back():
                            nav_msg = session.build_state_dict()
                            nav_msg.update({"type": "navigate"})
                            await websocket.send_json(nav_msg)
                        continue

                    elif msg_type == "undo":
                        undone_id = session.undo_last()
                        bot_txt = "Reverted previous answer."
                        session.add_bot_message(bot_txt)
                        nav_msg = session.build_state_dict()
                        nav_msg.update({
                            "type": "navigate",
                            "text": bot_txt
                        })
                        await websocket.send_json(nav_msg)
                        continue

                    elif msg_type == "cancel_edit":
                        session.cancel_editing()
                        nav_msg = session.build_state_dict()
                        nav_msg.update({"type": "navigate"})
                        await websocket.send_json(nav_msg)
                        continue

                except json.JSONDecodeError:
                    pass

            current_field = session.get_current_field()

            # A. BINARY WAV AUDIO RECEIVED
            if "bytes" in message and message["bytes"]:
                if session.is_locked():
                    await websocket.send_json({
                        "type": "error",
                        "message": "This form has already been submitted"
                    })
                    continue

                audio_bytes = message["bytes"]
                upload_time = round(time.time() - start_turn_time, 4)

                language_hint = auth_data.get("language_hint", "auto")
                transcript, detected_lang, stt_time = await transcribe_audio_wav(
                    audio_bytes, language_hint, current_field.description if current_field else None
                )

                if not transcript.strip():
                    state_msg = session.build_state_dict()
                    state_msg.update({
                        "type": "follow_up",
                        "text": f"I didn't hear anything. {current_field.question_en if current_field else ''}",
                        "debug_info": {"filter_status": "too_short_or_quiet", "counted_as_failure": False}
                    })
                    await websocket.send_json(state_msg)
                    continue

                # Check if audio transcript is "Accept All Proposals" command
                if is_accept_all_command(transcript):
                    async with AsyncSessionLocal() as db:
                        accepted = await session_manager.accept_proposals(submission_id, None, db)
                    bot_txt = "Accepted eligible document proposals."
                    session.add_bot_message(bot_txt)
                    nav_msg = session.build_state_dict()
                    nav_msg.update({"type": "navigate", "text": bot_txt})
                    await websocket.send_json(nav_msg)
                    continue

                # Echo Guard & Hallucination Filter Check
                is_echo, max_sim, matched_bot_msg = check_echo_guard(transcript, session.recent_bot_messages)
                if is_echo:
                    session.echo_drop_count += 1
                    drop_msg = session.build_state_dict()
                    drop_msg.update({
                        "type": "drop_silent",
                        "reason": "echo_detected",
                        "show_headphone_hint": (session.echo_drop_count >= 2),
                        "debug_info": {"filter_status": f"echo_drop (sim={max_sim:.2f})", "raw_transcript": transcript, "counted_as_failure": False}
                    })
                    await websocket.send_json(drop_msg)
                    continue

                is_hallucination, h_reason = check_hallucination_filter(transcript)
                if is_hallucination:
                    drop_msg = session.build_state_dict()
                    drop_msg.update({
                        "type": "drop_silent",
                        "reason": "hallucination_detected",
                        "debug_info": {"filter_status": f"hallucination_drop ({h_reason})", "raw_transcript": transcript, "counted_as_failure": False}
                    })
                    await websocket.send_json(drop_msg)
                    continue

                # Send transcript event
                await websocket.send_json({
                    "type": "transcript",
                    "text": transcript,
                    "language": detected_lang
                })

                normalized_text = normalize_transcript(transcript, current_field.data_type if current_field else None)

                # Navigation Command Parse
                nav_intent, target_fid, amb_fields, amb_msg = parse_navigation_command(
                    normalized_text, session.fields, current_field
                )

                if nav_intent == "undo":
                    session.undo_last()
                    bot_txt = "Reverted previous answer."
                    session.add_bot_message(bot_txt)
                    nav_msg = session.build_state_dict()
                    nav_msg.update({"type": "navigate", "text": bot_txt})
                    await websocket.send_json(nav_msg)
                    continue

                elif nav_intent == "back":
                    session.go_back()
                    nav_msg = session.build_state_dict()
                    nav_msg.update({"type": "navigate"})
                    await websocket.send_json(nav_msg)
                    continue

                elif nav_intent == "goto" and target_fid:
                    session.goto(target_fid)
                    tf = session.get_field_by_id(target_fid)
                    friendly_name = session.get_friendly_field_name(tf)
                    bot_txt = f"Okay, let's redo your {friendly_name}."
                    session.add_bot_message(bot_txt)
                    nav_msg = session.build_state_dict()
                    nav_msg.update({"type": "navigate", "text": bot_txt})
                    await websocket.send_json(nav_msg)
                    continue

                # LLM Field Extraction
                accumulated = session.get_accumulated_transcript()
                result, llm_time, path_taken = await extract_answer(
                    field_name=current_field.field_name,
                    data_type=current_field.data_type,
                    description=current_field.description,
                    transcript=normalized_text,
                    choices=current_field.choices,
                    language_hint=detected_lang,
                    accumulated_transcript=accumulated
                )

                if result.fulfilled and result.value:
                    session.record_answer(
                        field_id=current_field.id,
                        value=result.value,
                        raw_transcript=transcript,
                        language=detected_lang,
                        source="voice"
                    )
                    async with AsyncSessionLocal() as db:
                        res = await db.execute(
                            select(SubmissionAnswer).where(
                                SubmissionAnswer.submission_id == submission_id,
                                SubmissionAnswer.field_id == current_field.id
                            )
                        )
                        ans_db = res.scalar_one_or_none()
                        if ans_db:
                            ans_db.value = result.value
                            ans_db.raw_transcript = transcript
                            ans_db.language = detected_lang
                            ans_db.source = "voice"
                        else:
                            ans_db = SubmissionAnswer(
                                submission_id=submission_id,
                                field_id=current_field.id,
                                value=result.value,
                                raw_transcript=transcript,
                                language=detected_lang,
                                source="voice"
                            )
                            db.add(ans_db)
                        await db.commit()

                    session.advance()

                    ans_msg = session.build_state_dict()
                    ans_msg.update({
                        "type": "answer",
                        "field_id": current_field.id,
                        "value": result.value,
                        "fulfilled": True
                    })
                    await websocket.send_json(ans_msg)

                else:
                    retries = session.increment_retry()
                    friendly_name = session.get_friendly_field_name(current_field)
                    if retries >= 3:
                        bot_txt = f"Having trouble capturing {friendly_name}? Feel free to type your answer below."
                        session.add_bot_message(bot_txt)
                        off_msg = session.build_state_dict()
                        off_msg.update({
                            "type": "offer_typed_input",
                            "field_id": current_field.id,
                            "field_name": friendly_name,
                            "message": bot_txt
                        })
                        await websocket.send_json(off_msg)
                    else:
                        bot_txt = result.follow_up or f"I didn't quite catch that. Could you please provide your {friendly_name}?"
                        session.add_bot_message(bot_txt)
                        fu_msg = session.build_state_dict()
                        fu_msg.update({
                            "type": "follow_up",
                            "text": bot_txt
                        })
                        await websocket.send_json(fu_msg)

            # B. TEXT INPUT RECEIVED
            elif "text" in message and message["text"]:
                text_data = json.loads(message["text"])
                if text_data.get("type") == "text_input":
                    val = text_data.get("text", "").strip()

                    # Check if typed input is "accept all proposals"
                    if is_accept_all_command(val):
                        async with AsyncSessionLocal() as db:
                            accepted = await session_manager.accept_proposals(submission_id, None, db)
                        bot_txt = "Accepted eligible document proposals."
                        session.add_bot_message(bot_txt)
                        nav_msg = session.build_state_dict()
                        nav_msg.update({"type": "navigate", "text": bot_txt})
                        await websocket.send_json(nav_msg)
                        continue

                    target_field_id = text_data.get("field_id", current_field.id if current_field else None)
                    if target_field_id and val:
                        target_field_obj = session.get_field_by_id(target_field_id) or current_field
                        normalized_val = normalize_transcript(val, target_field_obj.data_type)

                        is_valid, cleaned, err = validate_rule(normalized_val, target_field_obj.data_type, target_field_obj.choices)
                        is_grd, g_reason = verify_grounding(cleaned if is_valid else normalized_val, val, target_field_obj.data_type)

                        if is_valid and is_grd:
                            session.record_answer(
                                field_id=target_field_id,
                                value=cleaned,
                                raw_transcript=val,
                                language="typed",
                                source="typed"
                            )
                            async with AsyncSessionLocal() as db:
                                res = await db.execute(
                                    select(SubmissionAnswer).where(
                                        SubmissionAnswer.submission_id == submission_id,
                                        SubmissionAnswer.field_id == target_field_id
                                    )
                                )
                                ans_db = res.scalar_one_or_none()
                                if ans_db:
                                    ans_db.value = cleaned
                                    ans_db.raw_transcript = val
                                    ans_db.language = "typed"
                                    ans_db.source = "typed"
                                else:
                                    ans_db = SubmissionAnswer(
                                        submission_id=submission_id,
                                        field_id=target_field_id,
                                        value=cleaned,
                                        raw_transcript=val,
                                        language="typed",
                                        source="typed"
                                    )
                                    db.add(ans_db)
                                await db.commit()

                            session.advance()

                            ans_msg = session.build_state_dict()
                            ans_msg.update({
                                "type": "answer",
                                "field_id": target_field_id,
                                "value": cleaned,
                                "fulfilled": True
                            })
                            await websocket.send_json(ans_msg)
                        else:
                            friendly_name = session.get_friendly_field_name(target_field_obj)
                            bot_txt = f"Invalid input for {friendly_name}: {err or g_reason}"
                            session.add_bot_message(bot_txt)
                            fu_msg = session.build_state_dict()
                            fu_msg.update({
                                "type": "follow_up",
                                "text": bot_txt
                            })
                            await websocket.send_json(fu_msg)

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected for submission {submission_id}")
    finally:
        if session and websocket in session.websockets:
            session.websockets.remove(websocket)
