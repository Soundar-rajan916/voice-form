import time
import json
import asyncio
from typing import Dict
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db import AsyncSessionLocal
from app.models import Submission, FormVersion, FormField, SubmissionAnswer
from app.security import decode_access_token
from app.services.session import FormSessionManager
from app.services.stt import transcribe_audio_wav
from app.services.extraction import extract_answer
from app.services.validation import validate_rule, fast_path_validate
from app.services.navigation import parse_navigation_command
from app.services.normalizer import normalize_transcript
from app.services.grounding import verify_grounding
from app.services.filters import check_echo_guard, check_hallucination_filter

router = APIRouter(prefix="/ws", tags=["websocket"])

active_sessions: Dict[int, FormSessionManager] = {}

async def async_persist_answer(submission_id: int, field_id: int, value: str, raw_transcript: str, language: str):
    """Asynchronously persists an answer to DB without blocking live voice turn."""
    async with AsyncSessionLocal() as db:
        try:
            res = await db.execute(
                select(SubmissionAnswer).where(
                    SubmissionAnswer.submission_id == submission_id,
                    SubmissionAnswer.field_id == field_id
                )
            )
            existing = res.scalar_one_or_none()
            if existing:
                existing.value = value
                existing.raw_transcript = raw_transcript
                existing.language = language
            else:
                new_ans = SubmissionAnswer(
                    submission_id=submission_id,
                    field_id=field_id,
                    value=value,
                    raw_transcript=raw_transcript,
                    language=language
                )
                db.add(new_ans)
            await db.commit()
        except Exception as e:
            print(f"[WS Persist] Error saving answer to DB: {e}")

@router.websocket("/submissions/{submission_id}")
async def websocket_submission_endpoint(websocket: WebSocket, submission_id: int):
    await websocket.accept()

    session_manager: FormSessionManager = None
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

    # Step 2: Load Submission and Version schema into server memory once
    async with AsyncSessionLocal() as db:
        res = await db.execute(
            select(Submission)
            .options(
                selectinload(Submission.version).selectinload(FormVersion.fields),
                selectinload(Submission.answers)
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

        session_manager = FormSessionManager(submission, submission.version)
        active_sessions[submission_id] = session_manager

    # Send Initial Ready Event using unified schema
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
        for f in session_manager.fields
    ]

    ready_state = session_manager.build_state_dict()
    ready_state.update({
        "type": "ready",
        "submission_id": submission_id,
        "fields": fields_payload,
        "answers": session_manager.answers
    })
    await websocket.send_json(ready_state)

    # Step 3: Realtime Voice & Text Input Loop
    try:
        while True:
            message = await websocket.receive()
            start_turn_time = time.time()

            # Handle JSON Control Commands (goto, back, undo, cancel_edit, reset_mic)
            if "text" in message and message["text"]:
                try:
                    text_data = json.loads(message["text"])
                    msg_type = text_data.get("type")
                    turn_num = text_data.get("turn_number")

                    # Idempotency Check
                    if turn_num is not None and turn_num <= session_manager.last_processed_turn_number:
                        st_msg = session_manager.build_state_dict()
                        st_msg.update({"type": "state_sync"})
                        await websocket.send_json(st_msg)
                        continue

                    if msg_type in ["goto", "back", "undo", "cancel_edit", "text_input", "reset_mic"]:
                        if session_manager.is_locked():
                            await websocket.send_json({
                                "type": "error",
                                "message": "Completed submissions are locked and cannot be edited"
                            })
                            continue

                    if msg_type == "reset_mic":
                        session_manager.reset_retries()
                        res_msg = session_manager.build_state_dict()
                        res_msg.update({"type": "mic_resumed"})
                        await websocket.send_json(res_msg)
                        continue

                    if msg_type == "goto":
                        target_id = text_data.get("field_id")
                        if target_id and session_manager.goto(target_id):
                            tf = session_manager.get_field_by_id(target_id)
                            friendly_name = session_manager.get_friendly_field_name(tf)
                            bot_txt = f"Okay, let's redo your {friendly_name}."
                            session_manager.add_bot_message(bot_txt)
                            nav_msg = session_manager.build_state_dict()
                            nav_msg.update({
                                "type": "navigate",
                                "text": bot_txt
                            })
                            await websocket.send_json(nav_msg)
                        continue

                    elif msg_type == "back":
                        if session_manager.go_back():
                            nav_msg = session_manager.build_state_dict()
                            nav_msg.update({"type": "navigate"})
                            await websocket.send_json(nav_msg)
                        continue

                    elif msg_type == "undo":
                        undone_id = session_manager.undo_last()
                        bot_txt = "Reverted previous answer."
                        session_manager.add_bot_message(bot_txt)
                        nav_msg = session_manager.build_state_dict()
                        nav_msg.update({
                            "type": "navigate",
                            "text": bot_txt
                        })
                        await websocket.send_json(nav_msg)
                        continue

                    elif msg_type == "cancel_edit":
                        session_manager.cancel_editing()
                        nav_msg = session_manager.build_state_dict()
                        nav_msg.update({"type": "navigate"})
                        await websocket.send_json(nav_msg)
                        continue

                except json.JSONDecodeError:
                    pass

            current_field = session_manager.get_current_field()
            if not current_field and session_manager.is_complete() and session_manager.mode != "editing":
                done_msg = session_manager.build_state_dict()
                done_msg.update({"type": "done", "message": "All fields filled"})
                await websocket.send_json(done_msg)
                continue

            # A. BINARY WAV AUDIO RECEIVED
            if "bytes" in message and message["bytes"]:
                if session_manager.is_locked():
                    await websocket.send_json({
                        "type": "error",
                        "message": "Completed submissions are locked and cannot be edited"
                    })
                    continue

                audio_bytes = message["bytes"]
                upload_time = round(time.time() - start_turn_time, 4)

                language_hint = auth_data.get("language_hint", "auto")
                transcript, detected_lang, stt_time = await transcribe_audio_wav(
                    audio_bytes, language_hint, current_field.description if current_field else None
                )

                if not transcript.strip():
                    state_msg = session_manager.build_state_dict()
                    state_msg.update({
                        "type": "follow_up",
                        "text": f"I didn't hear anything. {current_field.question_en if current_field else ''}",
                        "debug_info": {"filter_status": "too_short_or_quiet", "counted_as_failure": False}
                    })
                    await websocket.send_json(state_msg)
                    continue

                # 1. ECHO GUARD CHECK (Fix A & Fix 1)
                is_echo, max_sim, matched_bot_msg = check_echo_guard(transcript, session_manager.recent_bot_messages)
                if is_echo:
                    session_manager.echo_drop_count += 1
                    print(f"[WS Echo Drop #{session_manager.echo_drop_count}] Transcript '{transcript}' matched bot msg '{matched_bot_msg}' (sim={max_sim:.2f})")

                    show_headphone_hint = (session_manager.echo_drop_count >= 2)
                    drop_msg = session_manager.build_state_dict()
                    drop_msg.update({
                        "type": "drop_silent",
                        "reason": "echo_detected",
                        "show_headphone_hint": show_headphone_hint,
                        "debug_info": {
                            "filter_status": f"echo_drop (sim={max_sim:.2f})",
                            "raw_transcript": transcript,
                            "counted_as_failure": False
                        }
                    })
                    await websocket.send_json(drop_msg)
                    continue

                # 2. HALLUCINATION FILTER CHECK (Fix B & Fix 1)
                is_hallucination, h_reason = check_hallucination_filter(transcript)
                if is_hallucination:
                    print(f"[WS Hallucination Drop] Transcript '{transcript}' dropped: {h_reason}")
                    drop_msg = session_manager.build_state_dict()
                    drop_msg.update({
                        "type": "drop_silent",
                        "reason": "hallucination_detected",
                        "debug_info": {
                            "filter_status": f"hallucination_drop ({h_reason})",
                            "raw_transcript": transcript,
                            "counted_as_failure": False
                        }
                    })
                    await websocket.send_json(drop_msg)
                    continue

                # Send transcript event immediately
                await websocket.send_json({
                    "type": "transcript",
                    "text": transcript,
                    "language": detected_lang
                })

                # 3. DETERMINISTIC NORMALIZATION (Fix E)
                normalized_text = normalize_transcript(transcript, current_field.data_type if current_field else None)

                # 4. ANSWER-FIRST RULE CHECK (Fix C & Fix 3)
                is_direct_answer = False
                if current_field and current_field.data_type in ["Email", "Phone", "Number", "Date"]:
                    is_valid_ans, cleaned_ans, _ = validate_rule(normalized_text, current_field.data_type, current_field.choices)
                    is_grd, _ = verify_grounding(cleaned_ans if is_valid_ans else normalized_text, transcript, current_field.data_type)
                    if is_valid_ans and is_grd:
                        is_direct_answer = True

                nav_intent, target_fid, amb_fields, amb_msg = (None, None, None, None)
                if not is_direct_answer:
                    nav_intent, target_fid, amb_fields, amb_msg = parse_navigation_command(
                        normalized_text, session_manager.fields, current_field
                    )

                if nav_intent == "undo":
                    session_manager.undo_last()
                    bot_txt = "Reverted previous answer."
                    session_manager.add_bot_message(bot_txt)
                    nav_msg = session_manager.build_state_dict()
                    nav_msg.update({"type": "navigate", "text": bot_txt})
                    await websocket.send_json(nav_msg)
                    continue

                elif nav_intent == "back":
                    session_manager.go_back()
                    nav_msg = session_manager.build_state_dict()
                    nav_msg.update({"type": "navigate"})
                    await websocket.send_json(nav_msg)
                    continue

                elif nav_intent == "goto" and target_fid:
                    session_manager.goto(target_fid)
                    tf = session_manager.get_field_by_id(target_fid)
                    friendly_name = session_manager.get_friendly_field_name(tf)
                    bot_txt = f"Okay, let's redo your {friendly_name}."
                    session_manager.add_bot_message(bot_txt)
                    nav_msg = session_manager.build_state_dict()
                    nav_msg.update({
                        "type": "navigate",
                        "text": bot_txt
                    })
                    await websocket.send_json(nav_msg)
                    continue

                elif nav_intent == "ambiguous":
                    bot_txt = amb_msg or "Which field would you like to change?"
                    session_manager.add_bot_message(bot_txt)
                    state_msg = session_manager.build_state_dict()
                    state_msg.update({
                        "type": "follow_up",
                        "text": bot_txt
                    })
                    await websocket.send_json(state_msg)
                    continue

                # 5. LLM EXTRACTION & GROUNDING (Fix D)
                accumulated = session_manager.get_accumulated_transcript()
                result, llm_time, path_taken = await extract_answer(
                    field_name=current_field.field_name,
                    data_type=current_field.data_type,
                    description=current_field.description,
                    transcript=normalized_text,
                    choices=current_field.choices,
                    language_hint=detected_lang,
                    accumulated_transcript=accumulated
                )

                validation_time = 0.001
                total_turn_time = round(time.time() - start_turn_time, 4)

                timing_info = {
                    "upload_ms": int(upload_time * 1000),
                    "stt_ms": int(stt_time * 1000),
                    "llm_ms": int(llm_time * 1000),
                    "validation_ms": int(validation_time * 1000),
                    "total_ms": int(total_turn_time * 1000),
                    "filter_status": "clean",
                    "command_versus_answer": "answer" if not nav_intent else nav_intent,
                    "normalized_text": normalized_text,
                    "grounding_result": "grounded" if result.fulfilled else "not_grounded",
                    "raw_transcript": transcript
                }

                # LLM Navigation Intent Handlers
                if result.intent == "back":
                    session_manager.go_back()
                    nav_msg = session_manager.build_state_dict()
                    nav_msg.update({"type": "navigate"})
                    await websocket.send_json(nav_msg)
                    continue

                elif result.intent == "undo":
                    session_manager.undo_last()
                    bot_txt = "Reverted previous answer."
                    session_manager.add_bot_message(bot_txt)
                    nav_msg = session_manager.build_state_dict()
                    nav_msg.update({"type": "navigate", "text": bot_txt})
                    await websocket.send_json(nav_msg)
                    continue

                elif result.intent == "skip":
                    if not current_field.required:
                        session_manager.advance()
                        nav_msg = session_manager.build_state_dict()
                        nav_msg.update({"type": "navigate"})
                        await websocket.send_json(nav_msg)
                    else:
                        friendly_name = session_manager.get_friendly_field_name(current_field)
                        bot_txt = f"{friendly_name} is required and cannot be skipped."
                        session_manager.add_bot_message(bot_txt)
                        fu_msg = session_manager.build_state_dict()
                        fu_msg.update({
                            "type": "follow_up",
                            "text": bot_txt
                        })
                        await websocket.send_json(fu_msg)
                    continue

                elif result.intent == "repeat":
                    rep_msg = session_manager.build_state_dict()
                    rep_msg.update({"type": "repeat_question"})
                    await websocket.send_json(rep_msg)
                    continue

                # Answer Processing
                if result.incomplete:
                    session_manager.append_accumulated_transcript(transcript)
                    friendly_name = session_manager.get_friendly_field_name(current_field)
                    bot_txt = result.follow_up or f"Could you please complete your {friendly_name}?"
                    session_manager.add_bot_message(bot_txt)
                    timing_info["counted_as_failure"] = False
                    fu_msg = session_manager.build_state_dict()
                    fu_msg.update({
                        "type": "follow_up",
                        "text": bot_txt,
                        "timing": timing_info
                    })
                    await websocket.send_json(fu_msg)

                elif result.fulfilled and result.value:
                    session_manager.record_answer(
                        field_id=current_field.id,
                        value=result.value,
                        raw_transcript=transcript,
                        language=detected_lang
                    )
                    asyncio.create_task(
                        async_persist_answer(submission_id, current_field.id, result.value, transcript, detected_lang)
                    )

                    # Advance session manager
                    session_manager.advance()

                    timing_info["counted_as_failure"] = False
                    ans_msg = session_manager.build_state_dict()
                    ans_msg.update({
                        "type": "answer",
                        "field_id": current_field.id,
                        "value": result.value,
                        "fulfilled": True,
                        "timing": timing_info
                    })
                    await websocket.send_json(ans_msg)

                else:
                    # Increment failure count ONLY for genuine extraction/validation failures!
                    retries = session_manager.increment_retry()
                    friendly_name = session_manager.get_friendly_field_name(current_field)
                    timing_info["counted_as_failure"] = True
                    if retries >= 3:
                        bot_txt = f"Having trouble capturing {friendly_name}? Feel free to type your answer below."
                        session_manager.add_bot_message(bot_txt)
                        off_msg = session_manager.build_state_dict()
                        off_msg.update({
                            "type": "offer_typed_input",
                            "field_id": current_field.id,
                            "field_name": friendly_name,
                            "message": bot_txt,
                            "timing": timing_info
                        })
                        await websocket.send_json(off_msg)
                    else:
                        bot_txt = result.follow_up or f"I didn't quite catch that. Could you please provide your {friendly_name}?"
                        session_manager.add_bot_message(bot_txt)
                        fu_msg = session_manager.build_state_dict()
                        fu_msg.update({
                            "type": "follow_up",
                            "text": bot_txt,
                            "timing": timing_info
                        })
                        await websocket.send_json(fu_msg)

            # B. TEXT INPUT RECEIVED
            elif "text" in message and message["text"]:
                text_data = json.loads(message["text"])
                if text_data.get("type") == "text_input":
                    val = text_data.get("text", "").strip()
                    target_field_id = text_data.get("field_id", current_field.id if current_field else None)

                    if target_field_id and val:
                        target_field_obj = session_manager.get_field_by_id(target_field_id) or current_field

                        # Check if typed input is a navigation command first
                        nav_intent, target_fid, amb_fields, amb_msg = parse_navigation_command(
                            val, session_manager.fields, current_field
                        )
                        if nav_intent == "undo":
                            session_manager.undo_last()
                            bot_txt = "Reverted previous answer."
                            session_manager.add_bot_message(bot_txt)
                            nav_msg = session_manager.build_state_dict()
                            nav_msg.update({"type": "navigate", "text": bot_txt})
                            await websocket.send_json(nav_msg)
                            continue
                        elif nav_intent == "back":
                            session_manager.go_back()
                            nav_msg = session_manager.build_state_dict()
                            nav_msg.update({"type": "navigate"})
                            await websocket.send_json(nav_msg)
                            continue
                        elif nav_intent == "goto" and target_fid:
                            session_manager.goto(target_fid)
                            tf = session_manager.get_field_by_id(target_fid)
                            friendly_name = session_manager.get_friendly_field_name(tf)
                            bot_txt = f"Okay, let's redo your {friendly_name}."
                            session_manager.add_bot_message(bot_txt)
                            nav_msg = session_manager.build_state_dict()
                            nav_msg.update({"type": "navigate", "text": bot_txt})
                            await websocket.send_json(nav_msg)
                            continue
                        elif nav_intent == "ambiguous":
                            bot_txt = amb_msg or "Which field would you like to change?"
                            session_manager.add_bot_message(bot_txt)
                            state_msg = session_manager.build_state_dict()
                            state_msg.update({"type": "follow_up", "text": bot_txt})
                            await websocket.send_json(state_msg)
                            continue

                        normalized_val = normalize_transcript(val, target_field_obj.data_type)

                        # Validate typed input
                        is_valid, cleaned, err = validate_rule(normalized_val, target_field_obj.data_type, target_field_obj.choices)
                        is_grd, g_reason = verify_grounding(cleaned if is_valid else normalized_val, val, target_field_obj.data_type)

                        if is_valid and is_grd:
                            session_manager.record_answer(
                                field_id=target_field_id,
                                value=cleaned,
                                raw_transcript=val,
                                language="typed"
                            )
                            asyncio.create_task(
                                async_persist_answer(submission_id, target_field_id, cleaned, val, "typed")
                            )

                            session_manager.advance()

                            ans_msg = session_manager.build_state_dict()
                            ans_msg.update({
                                "type": "answer",
                                "field_id": target_field_id,
                                "value": cleaned,
                                "fulfilled": True
                            })
                            await websocket.send_json(ans_msg)
                        else:
                            friendly_name = session_manager.get_friendly_field_name(target_field_obj)
                            bot_txt = f"Invalid input for {friendly_name}: {err or g_reason}"
                            session_manager.add_bot_message(bot_txt)
                            fu_msg = session_manager.build_state_dict()
                            fu_msg.update({
                                "type": "follow_up",
                                "text": bot_txt
                            })
                            await websocket.send_json(fu_msg)

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected for submission {submission_id}")
    finally:
        if submission_id in active_sessions:
            del active_sessions[submission_id]
