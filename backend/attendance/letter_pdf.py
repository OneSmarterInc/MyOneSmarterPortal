"""Render the saved letter snapshot; never interpolate user text as PDF markup."""
from io import BytesIO
from pathlib import Path
import os
import json
import base64
from reportlab.lib.utils import ImageReader
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

CONTACT = 'akshay.kumar@onesmarter.com'
SIGNATORY = 'Akshay Agrawal'
TITLE = 'Global Delivery Manager'


def fonts():
    regular = os.environ.get('LOR_FONT_REGULAR', 'C:/Windows/Fonts/times.ttf')
    bold = os.environ.get('LOR_FONT_BOLD', 'C:/Windows/Fonts/timesbd.ttf')
    if Path(regular).is_file() and Path(bold).is_file():
        if 'LetterTimes' not in pdfmetrics.getRegisteredFontNames():
            pdfmetrics.registerFont(TTFont('LetterTimes', regular))
            pdfmetrics.registerFont(TTFont('LetterTimes-Bold', bold))
            pdfmetrics.registerFontFamily('LetterTimes', normal='LetterTimes', bold='LetterTimes-Bold')
        return 'LetterTimes', 'LetterTimes-Bold'
    return 'Times-Roman', 'Times-Bold'


def render_letter(data):
    normal, bold = fonts()
    stream = BytesIO()
    c = canvas.Canvas(stream, pagesize=(612, 792))
    c.setTitle('Letter of Recommendation - ' + data['name'])
    style = ParagraphStyle('Letter', fontName=normal, fontSize=11, leading=16)
    page = 0

    def header():
        nonlocal page
        page += 1
        artwork = json.loads(Path(__file__).with_name('letterhead.json').read_text())['png']
        c.drawImage(ImageReader(BytesIO(base64.b64decode(artwork))), 0, 713, width=612, height=79)
        c.setFillColor(HexColor('#c7192d')); c.rect(0, 0, 612, 14, fill=1, stroke=0)
        c.setFillColor(HexColor('#ffffff')); c.setFont(normal, 8); c.drawCentredString(306, 4, 'www.onesmarter.com')
        c.setFillColor(HexColor('#222222')); c.setFont(bold, 17)
        c.drawCentredString(306, 679, 'LETTER OF RECOMMENDATION')
        c.setFillColor(HexColor('#c7192d')); c.rect(266, 664, 80, 2, fill=1, stroke=0)
        c.setFillColor(HexColor('#777777')); c.setFont(normal, 8); c.drawRightString(544, 28, str(page))

    header()
    y = 640

    def paragraph(text, gap=12):
        nonlocal y
        item = Paragraph(text, style)
        _, height = item.wrap(476, 700)
        if y - height < 70:
            c.showPage(); header(); y = 640
        item.drawOn(c, 68, y - height)
        y -= height + gap

    d = {key: escape(str(value)) for key, value in data.items()}
    paragraph(f"<b>Date:</b> {d['issue_date']}", 18)
    paragraph('<b>To Whom It May Concern,</b>', 18)
    period = f"from {d['start_date']} to {d['end_date']}" if data.get('end_date') else f"since {d['start_date']} and continues in this role as of the date of this letter"
    paragraph(f"I am pleased to recommend <b>{d['name']}</b>, who {'worked' if data.get('end_date') else 'has been working'} with <b>One Smarter, Inc.</b> as <b>{d['designation']}</b> in {d['department']} {period}. In my capacity as {TITLE}, I have had the opportunity to review their work and contributions.")
    paragraph(f"During this period, {d['name']} contributed to {d['responsibilities']}. A notable contribution was {d['achievement']}, demonstrating {d['capability']}.")
    paragraph(f"{d['name']} demonstrated {d['strengths']}. For example, {d['example']}.")
    paragraph(f"Based on their contributions, I recommend {d['name']} for {d['recommendation_purpose']}. {d['endorsement']}")
    paragraph(f'Please contact me at <b>{CONTACT}</b> if you require any additional information.', 18)
    # Keep the entire sign-off together, even when the letter spans pages.
    paragraph(f'Sincerely,<br/><br/><b>{SIGNATORY}</b><br/>{TITLE}<br/>One Smarter, Inc.<br/>{CONTACT}', 0)
    c.save()
    return stream.getvalue()
