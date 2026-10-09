import io
import logging
import re
from typing import List, Dict, Any, Tuple, Optional

import pypdf
import pypdfium2 as pdfium
from docx import Document as DocxDocument
from PIL import Image

from app.config import settings

logger = logging.getLogger(__name__)

def is_garbled_text(text: str) -> bool:
    """
    Evaluates if extracted text layer is garbled, corrupted, low quality,
    or contains legacy-font Tamil gibberish or replacement characters.
    """
    if not text or not text.strip():
        return True

    text_strip = text.strip()
    # 1. Replacement character check
    if "\ufffd" in text_strip or text_strip.count("?") > max(10, len(text_strip) * 0.2):
        return True

    total_chars = len(text_strip)
    if total_chars < 5:
        return False

    # 2. Ratio of standard alphanumeric, spaces, common punctuation, and Tamil unicode
    # Unicode Tamil range is \u0b80-\u0bff
    valid_count = sum(
        1 for c in text_strip
        if c.isalnum() or c.isspace() or c in ".,!?-@:/()#%&'_$€₹\n\r" or ("\u0b80" <= c <= "\u0bff")
    )
    valid_ratio = valid_count / total_chars
    if valid_ratio < 0.65:
        return True

    # 3. Legacy-font Tamil gibberish check (e.g., high density of Latin-1 Supplement \u0080-\u00ff characters without actual Tamil unicode)
    latin1_ext_count = sum(1 for c in text_strip if "\u0080" <= c <= "\u00ff")
    tamil_count = sum(1 for c in text_strip if "\u0080" <= c <= "\u0bff")
    if latin1_ext_count > 5 and (tamil_count - latin1_ext_count) == 0:
        return True

    return False


def render_pdf_page_to_jpeg_bytes(pdf_bytes: bytes, page_index: int, dpi: int = 150) -> bytes:
    """
    Renders a PDF page to JPEG bytes in memory using pypdfium2.
    Downscales to max 1536px dimension to respect vision model limits.
    """
    pdf = pdfium.PdfDocument(pdf_bytes)
    page = pdf[page_index]

    # Calculate scale based on DPI (72 pt per inch standard PDF)
    scale = dpi / 72.0
    bitmap = page.render(scale=scale)
    pil_img = bitmap.to_pil()

    # Downscale if max dimension exceeds 1536px
    max_dim = max(pil_img.width, pil_img.height)
    if max_dim > 1536:
        ratio = 1536.0 / max_dim
        new_width = int(pil_img.width * ratio)
        new_height = int(pil_img.height * ratio)
        pil_img = pil_img.resize((new_width, new_height), Image.Resampling.LANCZOS)

    if pil_img.mode != "RGB":
        pil_img = pil_img.convert("RGB")

    buf = io.BytesIO()
    pil_img.save(buf, format="JPEG", quality=85)
    img_bytes = buf.getvalue()

    pdf.close()
    return img_bytes


class ProcessedPage:
    def __init__(self, page_num: int, read_method: str, text: str = "", image_bytes: Optional[bytes] = None):
        self.page_num = page_num
        self.read_method = read_method # "text_layer" or "vision"
        self.text = text
        self.image_bytes = image_bytes # Memory only


class DocumentParseResult:
    def __init__(self, pages: List[ProcessedPage], warning_msg: Optional[str] = None):
        self.pages = pages
        self.warning_msg = warning_msg


def parse_pdf_document(pdf_bytes: bytes) -> DocumentParseResult:
    """
    Parses a PDF document page by page.
    Routes clean text layer pages to 'text_layer' and scanned/garbled/image pages to 'vision'.
    Caps scanned pages to settings.VISION_MAX_PAGES (default 8).
    """
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    num_pages = len(reader.pages)

    if num_pages > settings.MAX_PDF_PAGES:
        raise ValueError(f"Document exceeds maximum allowed limit of {settings.MAX_PDF_PAGES} pages.")

    pages: List[ProcessedPage] = []
    scanned_pages_count = 0
    warning_msg = None

    for idx, pdf_page in enumerate(reader.pages):
        page_num = idx + 1
        raw_text = pdf_page.extract_text() or ""
        clean_text = raw_text.strip()

        # Determine if page has images or is mostly an image
        has_images = len(getattr(pdf_page, "images", [])) > 0
        word_count = len(clean_text.split())

        # Routing decision
        is_scanned_or_garbled = (
            word_count < 10 or
            is_garbled_text(clean_text) or
            (has_images and word_count < 25)
        )

        if is_scanned_or_garbled:
            if scanned_pages_count >= settings.VISION_MAX_PAGES:
                if not warning_msg:
                    warning_msg = f"Only the first {settings.VISION_MAX_PAGES} scanned pages were read."
                logger.info(f"[PDF Parse] Page {page_num} skipped vision processing due to VISION_MAX_PAGES cap.")
                continue

            scanned_pages_count += 1
            img_bytes = render_pdf_page_to_jpeg_bytes(pdf_bytes, idx, dpi=settings.VISION_DPI)
            pages.append(ProcessedPage(
                page_num=page_num,
                read_method="vision",
                text="",
                image_bytes=img_bytes
            ))
        else:
            pages.append(ProcessedPage(
                page_num=page_num,
                read_method="text_layer",
                text=clean_text,
                image_bytes=None
            ))

    return DocumentParseResult(pages=pages, warning_msg=warning_msg)


def parse_docx_document(docx_bytes: bytes) -> DocumentParseResult:
    """
    Parses a DOCX document using python-docx.
    Extracts text from paragraphs and tables.
    If the document contains large embedded images with little text, extracts images and routes to 'vision'.
    """
    doc = DocxDocument(io.BytesIO(docx_bytes))

    text_parts = []
    for p in doc.paragraphs:
        if p.text and p.text.strip():
            text_parts.append(p.text.strip())

    for table in doc.tables:
        for row in table.rows:
            row_text = " | ".join(cell.text.strip() for cell in row.cells if cell.text and cell.text.strip())
            if row_text:
                text_parts.append(row_text)

    doc_text = "\n".join(text_parts).strip()
    word_count = len(doc_text.split())

    # Extract inline image parts if present
    extracted_images: List[bytes] = []
    for rel in doc.part.rels.values():
        if "image" in rel.target_ref:
            try:
                img_data = rel.target_part.blob
                extracted_images.append(img_data)
            except Exception as e:
                logger.debug(f"[DOCX Parse] Could not extract image: {e}")

    pages: List[ProcessedPage] = []
    warning_msg = None

    # If DOCX has very little text but contains embedded scanned images, route images to vision
    if word_count < 30 and extracted_images:
        scanned_count = 0
        for idx, img_data in enumerate(extracted_images):
            page_num = idx + 1
            if scanned_count >= settings.VISION_MAX_PAGES:
                if not warning_msg:
                    warning_msg = f"Only the first {settings.VISION_MAX_PAGES} scanned pages were read."
                break

            # Convert to JPEG bytes in memory if needed
            try:
                pil_img = Image.open(io.BytesIO(img_data))
                if pil_img.mode != "RGB":
                    pil_img = pil_img.convert("RGB")
                buf = io.BytesIO()
                pil_img.save(buf, format="JPEG", quality=85)
                jpeg_bytes = buf.getvalue()

                scanned_count += 1
                pages.append(ProcessedPage(
                    page_num=page_num,
                    read_method="vision",
                    text="",
                    image_bytes=jpeg_bytes
                ))
            except Exception as e:
                logger.warning(f"[DOCX Parse] Image conversion failed for image {idx+1}: {e}")

        # If text also existed, include page 1 text_layer
        if doc_text:
            pages.append(ProcessedPage(
                page_num=scanned_count + 1,
                read_method="text_layer",
                text=doc_text,
                image_bytes=None
            ))
    else:
        # Standard DOCX with clean text layer
        pages.append(ProcessedPage(
            page_num=1,
            read_method="text_layer",
            text=doc_text if doc_text else "[Empty Document]",
            image_bytes=None
        ))

    return DocumentParseResult(pages=pages, warning_msg=warning_msg)
