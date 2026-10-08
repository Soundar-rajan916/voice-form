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
from app.services.validation import validate_rule

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

            current_field = session_manager.get_current_field()
            if not current_field and session_manager.is_complete():
                done_msg = session_manager.build_state_dict()
                done_msg.update({"type": "done", "message": "All fields filled"})
                await websocket.send_json(done_msg)
                continue

            # A. BINARY WAV AUDIO RECEIVED
            if "bytes" in message and message["bytes"]:
                audio_bytes = message["bytes"]
                upload_time = round(time.time() - start_turn_time, 4)

                language_hint = auth_data.get("language_hint", "auto")
                transcript, detected_lang, stt_time = await transcribe_audio_wav(audio_bytes, language_hint)

                # Send transcript event immediately
                await websocket.send_json({
                    "type": "transcript",
                    "text": transcript,
                    "language": detected_lang
                })

                if not transcript.strip():
                    state_msg = session_manager.build_state_dict()
                    state_msg.update({
                        "type": "follow_up",
                        "text": f"I didn't hear anything. {current_field.question_en if current_field else ''}"
                    })
                    await websocket.send_json(state_msg)
                    continue

                accumulated = session_manager.get_accumulated_transcript()
                result, llm_time, path_taken = await extract_answer(
                    field_name=current_field.field_name,
                    data_type=current_field.data_type,
                    description=current_field.description,
                    transcript=transcript,
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
                    "total_ms": int(total_turn_time * 1000)
                }

                # Voice Commands
                if result.intent == "back":
                    session_manager.go_back()
                    nav_msg = session_manager.build_state_dict()
                    nav_msg.update({"type": "navigate"})
                    await websocket.send_json(nav_msg)
                    continue

                elif result.intent == "skip":
                    if not current_field.required:
                        session_manager.advance()
                        nav_msg = session_manager.build_state_dict()
                        nav_msg.update({"type": "navigate"})
                        await websocket.send_json(nav_msg)
                    else:
                        fu_msg = session_manager.build_state_dict()
                        fu_msg.update({
                            "type": "follow_up",
                            "text": f"{current_field.field_name} is required and cannot be skipped."
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
                    fu_msg = session_manager.build_state_dict()
                    fu_msg.update({
                        "type": "follow_up",
                        "text": result.follow_up or f"Could you please complete your {current_field.field_name}?",
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

                    # Advance session manager FIRST
                    session_manager.advance()

                    # Build unified state message with updated field info
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
                    retries = session_manager.increment_retry()
                    if retries >= 3:
                        off_msg = session_manager.build_state_dict()
                        off_msg.update({
                            "type": "offer_typed_input",
                            "field_id": current_field.id,
                            "field_name": current_field.field_name,
                            "message": f"Having trouble capturing {current_field.field_name}? Feel free to type your answer below."
                        })
                        await websocket.send_json(off_msg)
                    else:
                        fu_msg = session_manager.build_state_dict()
                        fu_msg.update({
                            "type": "follow_up",
                            "text": result.follow_up or f"I didn't quite catch that. {current_field.question_en}",
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
                        # Find field by target_field_id
                        target_field_obj = next((f for f in session_manager.fields if f.id == target_field_id), current_field)
                        
                        # Validate typed input
                        is_valid, cleaned, err = validate_rule(val, target_field_obj.data_type, target_field_obj.choices)
                        if is_valid:
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
                            fu_msg = session_manager.build_state_dict()
                            fu_msg.update({
                                "type": "follow_up",
                                "text": f"Invalid input for {target_field_obj.field_name}: {err}"
                            })
                            await websocket.send_json(fu_msg)

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected for submission {submission_id}")
    finally:
        if submission_id in active_sessions:
            del active_sessions[submission_id]
