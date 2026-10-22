#!/usr/bin/env python3
"""Generate editable draw.io wireframes and a matching client-review PDF source."""

from __future__ import annotations

import html
import json
from pathlib import Path
import textwrap
import xml.etree.ElementTree as ET

from english_labels import english


ROOT = Path(__file__).resolve().parents[2]
REVIEW = ROOT / "review"
OUT_DRAWIO = REVIEW / "site-tracking-screen-sketches-v0.4.drawio"
OUT_HTML = REVIEW / "site-tracking-client-review-v0.4.html"
OUT_MANIFEST = REVIEW / "screen-inventory-v0.4.json"

W, H = 1169, 827
FONT = "Arial"

COLORS = {
    "ink": "#172033",
    "muted": "#526077",
    "line": "#CBD5E1",
    "soft": "#F1F5F9",
    "paper": "#FFFFFF",
    "bg": "#F8FAFC",
    "nav": "#263247",
    "primary": "#475569",
    "accent": "#C2410C",
    "accent_soft": "#FFF1E8",
    "green": "#166534",
    "green_soft": "#ECFDF3",
    "red": "#B42318",
    "red_soft": "#FEF3F2",
    "amber": "#92400E",
    "amber_soft": "#FFFBEB",
    "blue": "#1D4ED8",
    "blue_soft": "#EFF6FF",
}


def esc(value: object) -> str:
    return html.escape(str(value), quote=True)


class Page:
    def __init__(self, page_id: str, title: str, subtitle: str, role: str = ""):
        self.page_id = page_id
        self.title = english(title)
        self.subtitle = english(subtitle)
        self.role = english(role)
        self.cells: list[dict] = []
        self.svg: list[str] = []
        self._counter = 1
        self._add_background()

    def _id(self) -> str:
        value = f"{self.page_id}-{self._counter}"
        self._counter += 1
        return value

    def _add_background(self) -> None:
        self.rect(0, 0, W, H, fill=COLORS["bg"], stroke="none")
        self.rect(0, 0, W, 12, fill=COLORS["accent"], stroke="none")
        self.text(42, 30, 875, 34, self.title, size=24, bold=True)
        self.text(42, 66, 900, 24, self.subtitle, size=12, color=COLORS["muted"])
        if self.role:
            self.badge(980, 35, 145, 32, self.role, fill=COLORS["soft"], color=COLORS["ink"])
        self.text(42, 797, 930, 18, "Review sketch · આવૃત્તિ ૦.૪ · Final UI નથી", size=10, color=COLORS["muted"])
        self.text(1030, 797, 95, 18, self.page_id, size=10, color=COLORS["muted"], align="right")

    def rect(self, x, y, w, h, fill="#FFFFFF", stroke="#CBD5E1", radius=8,
             label="", size=13, color=None, bold=False, align="left", valign="middle",
             dashed=False, stroke_width=1.2) -> str:
        cid = self._id()
        label = english(label)
        style = (
            f"rounded={1 if radius else 0};whiteSpace=wrap;html=1;"
            f"fillColor={fill};strokeColor={stroke};strokeWidth={stroke_width};"
            f"fontFamily={FONT};fontSize={size};fontColor={color or COLORS['ink']};"
            f"fontStyle={1 if bold else 0};align={align};verticalAlign={valign};"
            f"spacingLeft=10;spacingRight=10;spacingTop=6;spacingBottom=6;"
            f"dashed={1 if dashed else 0};arcSize=12;"
        )
        self.cells.append({"kind": "vertex", "id": cid, "value": label, "style": style,
                           "x": x, "y": y, "w": w, "h": h})
        rx = radius if radius else 0
        dash = ' stroke-dasharray="7 5"' if dashed else ""
        stroke_svg = "none" if stroke == "none" else stroke
        self.svg.append(
            f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" '
            f'fill="{fill}" stroke="{stroke_svg}" stroke-width="{stroke_width}"{dash}/>'
        )
        if label:
            self._svg_text(x + (w / 2 if align == "center" else 12), y + h / 2, w - 24, label,
                           size=size, color=color or COLORS["ink"], bold=bold,
                           align=align, valign=valign)
        return cid

    def text(self, x, y, w, h, label, size=13, color=None, bold=False, align="left") -> str:
        cid = self._id()
        label = english(label)
        style = (
            f"text;html=1;strokeColor=none;fillColor=none;whiteSpace=wrap;"
            f"fontFamily={FONT};fontSize={size};fontColor={color or COLORS['ink']};"
            f"fontStyle={1 if bold else 0};align={align};verticalAlign=middle;"
        )
        self.cells.append({"kind": "vertex", "id": cid, "value": label, "style": style,
                           "x": x, "y": y, "w": w, "h": h})
        px = x + (w / 2 if align == "center" else w if align == "right" else 0)
        self._svg_text(px, y + h / 2, w, label, size=size, color=color or COLORS["ink"],
                       bold=bold, align=align)
        return cid

    def _svg_text(self, x, y, width, label, size=13, color="#172033", bold=False,
                  align="left", valign="middle"):
        max_chars = max(8, int(width / max(size * 0.62, 1)))
        lines = []
        for source_line in str(label).split("\n"):
            wrapped = textwrap.wrap(
                source_line,
                width=max_chars,
                break_long_words=False,
                break_on_hyphens=False,
                replace_whitespace=False,
            )
            lines.extend(wrapped or [""])
        anchor = {"left": "start", "center": "middle", "right": "end"}.get(align, "start")
        line_height = size * 1.42
        start_y = y - ((len(lines) - 1) * line_height / 2)
        for i, line in enumerate(lines):
            self.svg.append(
                f'<text x="{x}" y="{start_y + i * line_height}" fill="{color}" '
                f'font-family="{FONT}, sans-serif" font-size="{size}" '
                f'font-weight="{700 if bold else 400}" text-anchor="{anchor}" '
                f'dominant-baseline="middle">{esc(line)}</text>'
            )

    def line(self, x1, y1, x2, y2, color=None, arrow=False, dashed=False, width=2):
        cid = self._id()
        style = (
            f"edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor={color or COLORS['line']};"
            f"strokeWidth={width};dashed={1 if dashed else 0};"
            f"endArrow={'block' if arrow else 'none'};endFill=1;"
        )
        self.cells.append({"kind": "edge", "id": cid, "style": style,
                           "x1": x1, "y1": y1, "x2": x2, "y2": y2})
        dash = ' stroke-dasharray="7 5"' if dashed else ""
        marker = ' marker-end="url(#arrow)"' if arrow else ""
        self.svg.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
                        f'stroke="{color or COLORS["line"]}" stroke-width="{width}"{dash}{marker}/>' )
        return cid

    def badge(self, x, y, w, h, label, fill=None, color=None):
        return self.rect(x, y, w, h, fill=fill or COLORS["blue_soft"], stroke="none", radius=16,
                         label=label, size=11, color=color or COLORS["blue"], bold=True, align="center")

    def note(self, x, y, w, h, label, pending=False):
        fill = COLORS["amber_soft"] if pending else COLORS["blue_soft"]
        stroke = "#F59E0B" if pending else "#93C5FD"
        prefix = "Decision pending: " if pending else "Review note: "
        return self.rect(x, y, w, h, fill=fill, stroke=stroke, radius=8,
                         label=prefix + english(label), size=11, color=COLORS["amber"] if pending else COLORS["ink"])

    def button(self, x, y, w, label, primary=True, danger=False):
        if danger:
            fill, color, stroke = COLORS["red"], "#FFFFFF", COLORS["red"]
        elif primary:
            fill, color, stroke = COLORS["accent"], "#FFFFFF", COLORS["accent"]
        else:
            fill, color, stroke = "#FFFFFF", COLORS["ink"], COLORS["line"]
        return self.rect(x, y, w, 40, fill=fill, stroke=stroke, radius=7,
                         label=label, size=12, color=color, bold=True, align="center")

    def field(self, x, y, w, label, value="", required=False, h=56):
        label = english(label)
        self.text(x, y, w, 18, f"{label}{' *' if required else ''}", size=10, color=COLORS["muted"], bold=True)
        return self.rect(x, y + 20, w, h - 20, fill="#FFFFFF", stroke=COLORS["line"], radius=6,
                         label=value, size=12, color=COLORS["ink"])

    def status(self, x, y, label, kind="neutral", w=92):
        scheme = {
            "success": (COLORS["green_soft"], COLORS["green"]),
            "warning": (COLORS["amber_soft"], COLORS["amber"]),
            "danger": (COLORS["red_soft"], COLORS["red"]),
            "info": (COLORS["blue_soft"], COLORS["blue"]),
            "neutral": (COLORS["soft"], COLORS["muted"]),
        }[kind]
        return self.badge(x, y, w, 28, label, fill=scheme[0], color=scheme[1])

    def web_shell(self, screen_title: str, active: str = "પ્રોજેક્ટ"):
        x, y, w, h = 55, 110, 820, 620
        self.rect(x, y, w, h, fill="#FFFFFF", stroke="#94A3B8", radius=10)
        self.rect(x, y, 170, h, fill=COLORS["nav"], stroke=COLORS["nav"], radius=10)
        self.text(x + 18, y + 18, 135, 30, "SiteTrack", size=17, color="#FFFFFF", bold=True)
        navs = ["સારાંશ", "પ્રોજેક્ટ", "સાઇટ", "લોકો અને ટીમ", "સેટિંગ"]
        for i, nav in enumerate(navs):
            yy = y + 82 + i * 48
            fill = "#3B485E" if nav == active else COLORS["nav"]
            self.rect(x + 10, yy, 150, 38, fill=fill, stroke="none", radius=6,
                      label=nav, size=11, color="#FFFFFF", bold=nav == active)
        self.rect(x + 170, y, w - 170, 60, fill="#FFFFFF", stroke="#E2E8F0", radius=0)
        self.text(x + 194, y + 15, 400, 30, screen_title, size=17, bold=True)
        self.badge(x + 690, y + 15, 105, 30, "AD · એડમિન", fill=COLORS["soft"], color=COLORS["ink"])
        return x + 194, y + 84, w - 218, h - 112

    def mobile_shell(self, screen_title: str, role="સુપરવાઇઝર", active="કામ"):
        x, y, w, h = 72, 112, 340, 638
        self.rect(x, y, w, h, fill="#FFFFFF", stroke="#64748B", radius=24)
        self.rect(x, y, w, 34, fill=COLORS["nav"], stroke=COLORS["nav"], radius=24)
        self.text(x + 18, y + 7, 120, 18, "9:41", size=10, color="#FFFFFF", bold=True)
        self.text(x + 20, y + 50, 210, 30, screen_title, size=17, bold=True)
        self.badge(x + 236, y + 51, 84, 26, role, fill=COLORS["soft"], color=COLORS["ink"])
        self.rect(x, y + h - 66, w, 66, fill="#FFFFFF", stroke="#E2E8F0", radius=18)
        navs = ["કામ", "પ્રગતિ", "પ્રોફાઇલ"]
        for i, nav in enumerate(navs):
            xx = x + 18 + i * 104
            color = COLORS["accent"] if nav == active else COLORS["muted"]
            self.text(xx, y + h - 51, 96, 26, nav, size=10, color=color, bold=nav == active, align="center")
        return x + 20, y + 96, w - 40, h - 182

    def to_diagram(self) -> ET.Element:
        diagram = ET.Element("diagram", {"id": self.page_id, "name": f"{self.page_id} · {self.title}"})
        model = ET.SubElement(diagram, "mxGraphModel", {
            "dx": "1200", "dy": "900", "grid": "1", "gridSize": "10", "guides": "1",
            "tooltips": "1", "connect": "1", "arrows": "1", "fold": "1", "page": "1",
            "pageScale": "1", "pageWidth": str(W), "pageHeight": str(H), "math": "0", "shadow": "0"
        })
        root = ET.SubElement(model, "root")
        ET.SubElement(root, "mxCell", {"id": "0"})
        ET.SubElement(root, "mxCell", {"id": "1", "parent": "0"})
        for cell in self.cells:
            if cell["kind"] == "vertex":
                node = ET.SubElement(root, "mxCell", {
                    "id": cell["id"], "value": cell["value"], "style": cell["style"],
                    "vertex": "1", "parent": "1"
                })
                ET.SubElement(node, "mxGeometry", {
                    "x": str(cell["x"]), "y": str(cell["y"]), "width": str(cell["w"]),
                    "height": str(cell["h"]), "as": "geometry"
                })
            else:
                node = ET.SubElement(root, "mxCell", {
                    "id": cell["id"], "style": cell["style"], "edge": "1", "parent": "1"
                })
                geom = ET.SubElement(node, "mxGeometry", {"relative": "1", "as": "geometry"})
                ET.SubElement(geom, "mxPoint", {"x": str(cell["x1"]), "y": str(cell["y1"]), "as": "sourcePoint"})
                ET.SubElement(geom, "mxPoint", {"x": str(cell["x2"]), "y": str(cell["y2"]), "as": "targetPoint"})
        return diagram

    def svg_markup(self) -> str:
        return (
            f'<svg viewBox="0 0 {W} {H}" xmlns="http://www.w3.org/2000/svg" role="img" '
            f'aria-label="{esc(self.title)}"><defs><marker id="arrow" markerWidth="8" markerHeight="8" '
            f'refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="{COLORS["muted"]}"/>'
            f'</marker></defs>{"".join(self.svg)}</svg>'
        )


def card(p, x, y, w, title, body, badge=None, pending=False, h=112):
    p.rect(x, y, w, h, fill=COLORS["amber_soft"] if pending else "#FFFFFF",
           stroke="#F59E0B" if pending else COLORS["line"], radius=10)
    p.text(x + 16, y + 12, w - 32, 24, title, size=14, bold=True,
           color=COLORS["amber"] if pending else COLORS["ink"])
    p.text(x + 16, y + 42, w - 32, h - 52, body, size=11, color=COLORS["muted"])
    if badge:
        p.badge(x + w - 96, y + 10, 80, 26, badge)


def build_pages() -> list[Page]:
    pages: list[Page] = []

    p = Page("00", "Client review માર્ગદર્શિકા", "આ sketches ફક્ત હાલની requirements સમજવા અને નિર્ણય લેવા માટે છે")
    p.rect(42, 118, 1085, 144, fill=COLORS["nav"], stroke=COLORS["nav"], radius=12)
    p.text(74, 142, 780, 42, "Site Tracking System", size=30, color="#FFFFFF", bold=True)
    p.text(74, 190, 850, 38, "Editable draw.io screen sketches · ૨૨ ઑક્ટોબર ૨૦૨૬", size=15, color="#E2E8F0")
    card(p, 42, 294, 330, "શું નક્કી છે", "Roles, Project→Site બંધારણ, stage assignment, online photos, review અને history.", "નક્કી")
    card(p, 390, 294, 330, "શું નથી", "Materials, GPS/location, offline queue/sync, iOS અને Team login.", "બહાર")
    card(p, 738, 294, 389, "પીળું box શું કહે છે?", "તે product decision હજી બાકી છે; તેને confirmed feature ન માનવું.", "બાકી", pending=True)
    p.text(42, 450, 1085, 30, "Review કરવાની સરળ રીત", size=18, bold=True)
    steps = [("૧", "Overall flow"), ("૨", "Role અને access"), ("૩", "Web / Android screens"), ("૪", "Special cases"), ("૫", "બાકી નિર્ણયો")]
    for i, (n, label) in enumerate(steps):
        x = 42 + i * 215
        p.badge(x, 505, 42, 42, n, fill=COLORS["accent_soft"], color=COLORS["accent"])
        p.text(x + 52, 508, 150, 36, label, size=12, bold=True)
        if i < 4:
            p.line(x + 188, 526, x + 210, 526, color=COLORS["muted"], arrow=True)
    p.note(42, 610, 1085, 74, "બધી વ્યક્તિ, site અને project માહિતી નમૂના માટે કલ્પિત છે. કોઈ વાસ્તવિક client/employee data નથી.")
    pages.append(p)

    p = Page("01", "મુખ્ય કામનો પ્રવાહ", "Admin setupથી stage approval સુધીનો confirmed journey")
    flow = [
        ("એડમિન setup", "Site પ્રકાર + default stages\nકર્મચારી + Team contact"),
        ("પ્રોજેક્ટ", "એડમિન project બનાવે"),
        ("સાઇટ", "Projectની અંદર Site\nઅને Site Coordinator"),
        ("સોંપણી", "દરેક stage પર\nSupervisor + Team"),
        ("પુરાવો", "Supervisor online ફોટા\nઅને completion request"),
        ("Review", "Admin / Site Coordinator\napprove અથવા સુધારો"),
    ]
    for i, (title, body) in enumerate(flow):
        x = 36 + i * 188
        p.rect(x, 180, 162, 154, fill="#FFFFFF", stroke=COLORS["line"], radius=12)
        p.badge(x + 14, 196, 38, 32, str(i + 1), fill=COLORS["accent_soft"], color=COLORS["accent"])
        p.text(x + 14, 240, 134, 28, title, size=14, bold=True)
        p.text(x + 14, 278, 134, 48, body, size=10, color=COLORS["muted"])
        if i < len(flow) - 1:
            p.line(x + 162, 257, x + 184, 257, color=COLORS["muted"], arrow=True)
    card(p, 72, 394, 300, "ચાલુ stageમાં ફેરફાર", "Admin અથવા એ Siteનો Coordinator Supervisor, Team અથવા બંને બદલી શકે.", "Confirmed", h=122)
    card(p, 434, 394, 300, "History જળવાય", "જૂના ફોટા, author, progress અને approval history મટતી નથી; કામ reset થતું નથી.", "Confirmed", h=122)
    card(p, 796, 394, 300, "બીજી Coordinatorની Site", "Linked Site માટે માત્ર basic progress; private photos અથવા action controls નહીં.", "Confirmed", h=122)
    p.note(72, 566, 1024, 88, "Final stage મંજૂર થાય પછી Site આપમેળે complete ગણાય? Project status કેવી રીતે નીકળે?", pending=True)
    pages.append(p)

    p = Page("02", "Roles, platform અને permission", "કોણ ક્યાં login કરે અને મુખ્ય અધિકાર શું છે")
    cols = [(42, 260, "એડમિન", "Web + Android", "બધી Site જુઓ\nProject/Site edit\nPeople/Team edit\nAssign, upload, review"),
            (322, 260, "પ્રોજેક્ટ કોઓર્ડિનેટર", "Web + Android", "પોતાની Site પર assign\nupload + review\nLinked Site basic progress\nTeam contact view"),
            (602, 240, "સુપરવાઇઝર", "Android only", "Assigned work જુઓ\nTeam contact જુઓ\nફોટા upload\ncompletion request"),
            (862, 265, "કામ કરતી Team", "App account નથી", "સ્થળ પર કામ\nનામ + contact person\nવિગતો Admin edit કરે")]
    for x, w, title, platform, body in cols:
        p.rect(x, 144, w, 296, fill="#FFFFFF", stroke=COLORS["line"], radius=12)
        p.text(x + 18, 166, w - 36, 34, title, size=16, bold=True)
        p.badge(x + 18, 212, w - 36, 32, platform, fill=COLORS["soft"], color=COLORS["ink"])
        p.text(x + 18, 270, w - 36, 130, body, size=12, color=COLORS["muted"])
    p.rect(42, 478, 1085, 184, fill="#FFFFFF", stroke=COLORS["line"], radius=12)
    p.text(62, 496, 1045, 28, "ઝડપી permission check", size=15, bold=True)
    rows = [
        ("Project/Site create અથવા details/link બદલવી", "એડમિન", "ના", "ના"),
        ("Stage પર Supervisor/Team assign/change", "બધી Site", "પોતાની Site", "ના"),
        ("Photos upload / review", "બધી Site", "પોતાની Site", "Upload only"),
        ("Team details edit", "હા", "ના", "ના"),
    ]
    headers = ["કામ", "એડમિન", "Coordinator", "Supervisor"]
    xs = [62, 552, 730, 925]
    ws = [470, 158, 175, 160]
    for x, w, htxt in zip(xs, ws, headers):
        p.rect(x, 536, w, 26, fill=COLORS["soft"], stroke="none", radius=4, label=htxt, size=10, bold=True, align="center")
    for ridx, row in enumerate(rows):
        yy = 566 + ridx * 24
        for x, w, val in zip(xs, ws, row):
            p.text(x + 8, yy, w - 16, 20, val, size=9, align="left" if x == xs[0] else "center")
    p.note(42, 686, 1085, 64, "કોઈ permanent Supervisor → Coordinator mapping નથી. Supervisor અલગ Coordinatorsની Sites પર કામ કરી શકે.")
    pages.append(p)

    p = Page("03", "Admin setup અને master data", "Site પ્રકાર/stages, employees અને Team contact records", "એડમિન · વેબ")
    cx, cy, cw, ch = p.web_shell("Setup", active="સેટિંગ")
    card(p, cx, cy, 185, "Site પ્રકાર", "Shed\nSolar\n+ નવો પ્રકાર", h=126)
    card(p, cx + 205, cy, 185, "Default stages", "Foundation\nStructure\nFinishing", h=126)
    card(p, cx + 410, cy, 185, "Employees", "Coordinator\nSupervisor\n+ કર્મચારી", h=126)
    card(p, cx, cy + 150, 288, "Team contact record", "નામ: Shakti Team\nContact: Harish Patel\nમોબાઇલ: 98••• ••210", "Login નથી", h=146)
    p.button(cx + 314, cy + 174, 146, "+ Team ઉમેરો")
    p.button(cx + 476, cy + 174, 119, "Edit", primary=False)
    p.note(910, 142, 217, 126, "Team માટે account/login નથી. Team details ફક્ત Admin બદલે.")
    p.note(910, 292, 217, 126, "Stage dependency અથવા blocking rules હજી નક્કી નથી.", pending=True)
    p.note(910, 442, 217, 126, "Exact required fields final design પહેલાં નક્કી કરવા.", pending=True)
    pages.append(p)

    p = Page("04", "નવો Project બનાવવો", "Project વગર Site બની શકતી નથી", "એડમિન · વેબ")
    cx, cy, cw, ch = p.web_shell("નવો Project", active="પ્રોજેક્ટ")
    p.field(cx, cy, 286, "Project નામ", "ઉદાહરણ: Sunrise Campus", True)
    p.field(cx + 308, cy, 286, "કામ પૂરું કરવાની તારીખ", "DD / MM / YYYY")
    p.field(cx, cy + 82, 594, "Project સરનામું / નોંધ", "નમૂના માહિતી", h=76)
    p.note(cx, cy + 178, 594, 64, "ફક્ત નામ/સરનામું/તારીખ requirementમાં ઉદાહરણ તરીકે છે; exact field list મંજૂર કરવાની બાકી.", pending=True)
    p.button(cx + 332, cy + 274, 126, "રદ કરો", primary=False)
    p.button(cx + 472, cy + 274, 122, "Project સાચવો")
    p.note(910, 142, 217, 96, "Save પછી Site ઉમેરવાની આગળની screen.")
    p.note(910, 264, 217, 116, "Coordinator Project સ્તરે નહીં; દરેક Site પર અલગ પસંદ થાય.")
    p.note(910, 406, 217, 122, "Project status calculation હજી નક્કી કરવાનું.", pending=True)
    pages.append(p)

    p = Page("05", "Projectની અંદર Site બનાવવી", "Site type અને Site Coordinator પસંદ કરવો ફરજિયાત", "એડમિન · વેબ")
    cx, cy, cw, ch = p.web_shell("Sunrise Campus → નવી Site", active="સાઇટ")
    p.field(cx, cy, 286, "Site નામ", "Shed A", True)
    p.field(cx + 308, cy, 286, "Site પ્રકાર", "Shed  ▾", True)
    p.field(cx, cy + 82, 286, "Site Coordinator", "Kavita Shah  ▾", True)
    p.field(cx + 308, cy + 82, 286, "Completion date", "DD / MM / YYYY")
    p.field(cx, cy + 164, 594, "Site સરનામું", "નમૂના સરનામું", h=70)
    p.button(cx + 320, cy + 264, 138, "પાછા", primary=False)
    p.button(cx + 474, cy + 264, 120, "Site બનાવો")
    p.note(910, 142, 217, 116, "Site હંમેશાં એક Project સાથે જોડાયેલી રહેશે.")
    p.note(910, 284, 217, 116, "Site બીજા Projectમાં move કરવાનો અધિકાર ફક્ત Adminને.")
    p.note(910, 426, 217, 118, "Site typeથી default stages આવે; stage dependency ન બતાવવી.", pending=True)
    pages.append(p)

    p = Page("06", "Project overview: અલગ Sites, અલગ Coordinators", "એક Projectમાં અલગ Site types હોઈ શકે", "એડમિન · વેબ")
    cx, cy, cw, ch = p.web_shell("Sunrise Campus", active="પ્રોજેક્ટ")
    p.text(cx, cy, 360, 28, "Project Sites", size=16, bold=True)
    p.button(cx + 454, cy - 6, 140, "+ Site ઉમેરો")
    sites = [
        ("Shed A", "Shed", "Coordinator: Kavita Shah", "4 / 6 stages", "ચાલુ"),
        ("Solar Roof", "Solar", "Coordinator: Imran Khan", "2 / 5 stages", "ચાલુ"),
        ("Shed B", "Shed", "Coordinator: Kavita Shah", "0 / 6 stages", "સોંપવું બાકી"),
    ]
    for i, row in enumerate(sites):
        yy = cy + 48 + i * 92
        p.rect(cx, yy, 594, 76, fill="#FFFFFF", stroke=COLORS["line"], radius=8)
        p.text(cx + 16, yy + 10, 180, 26, row[0], size=13, bold=True)
        p.badge(cx + 198, yy + 10, 72, 26, row[1], fill=COLORS["soft"], color=COLORS["ink"])
        p.text(cx + 16, yy + 42, 280, 22, row[2], size=10, color=COLORS["muted"])
        p.text(cx + 320, yy + 14, 120, 22, row[3], size=10, color=COLORS["muted"])
        p.status(cx + 474, yy + 12, row[4], "info" if i < 2 else "warning", 104)
    p.note(910, 142, 217, 112, "Shed અને Solar એક જ Projectમાં રહે શકે; dependency implied નથી.")
    p.note(910, 280, 217, 112, "દરેક Siteનો પોતાનો Coordinator દેખાય છે.")
    p.note(910, 418, 217, 126, "Progress અને Project/Site status કેવી રીતે ગણવા તે નક્કી કરવાનું.", pending=True)
    pages.append(p)

    p = Page("07", "દરેક Stage પર Supervisor + Team સોંપવી", "Admin અથવા તે Siteનો Coordinator સોંપી/બદલી શકે", "વેબ")
    cx, cy, cw, ch = p.web_shell("Shed A → Foundation stage", active="સાઇટ")
    p.status(cx, cy, "ચાલુ stage", "info", 104)
    p.field(cx, cy + 48, 286, "Supervisor", "Rakesh Solanki  ▾", True)
    p.field(cx + 308, cy + 48, 286, "Team", "Shakti Team  ▾", True)
    p.rect(cx, cy + 132, 594, 78, fill=COLORS["soft"], stroke="none", radius=8)
    p.text(cx + 16, cy + 144, 540, 24, "Team contact", size=11, bold=True)
    p.text(cx + 16, cy + 172, 540, 22, "Harish Patel · 98••• ••210 · view only", size=10, color=COLORS["muted"])
    p.button(cx + 306, cy + 238, 140, "રદ કરો", primary=False)
    p.button(cx + 462, cy + 238, 132, "સોંપણી સાચવો")
    p.note(910, 142, 217, 126, "Coordinator પોતાની Site માટે કોઈપણ Supervisor પસંદ કરી શકે.")
    p.note(910, 294, 217, 126, "ચાલુ કામમાં પણ Supervisor, Team અથવા બંને બદલી શકાય.")
    p.note(910, 446, 217, 126, "ફેરફારથી progress અથવા અગાઉના પુરાવા reset નહીં થાય.")
    pages.append(p)

    p = Page("08", "Coordinator dashboard અને linked Site access", "પોતાની Site માટે full action; બીજી linked Site માટે basic progress", "Coordinator · વેબ")
    cx, cy, cw, ch = p.web_shell("મારી Sites", active="સારાંશ")
    p.rect(cx, cy, 594, 128, fill="#FFFFFF", stroke=COLORS["line"], radius=10)
    p.text(cx + 16, cy + 14, 300, 24, "Shed A", size=15, bold=True)
    p.badge(cx + 420, cy + 12, 158, 28, "મારી Site · Full access", fill=COLORS["green_soft"], color=COLORS["green"])
    p.text(cx + 16, cy + 50, 360, 24, "4 / 6 stages · 67%", size=12, color=COLORS["muted"])
    p.button(cx + 370, cy + 68, 96, "Assign")
    p.button(cx + 482, cy + 68, 96, "Review", primary=False)
    p.rect(cx, cy + 148, 594, 128, fill="#FFFFFF", stroke=COLORS["line"], radius=10)
    p.text(cx + 16, cy + 162, 300, 24, "Solar Roof", size=15, bold=True)
    p.badge(cx + 388, cy + 160, 190, 28, "Linked Site · Basic progress", fill=COLORS["soft"], color=COLORS["muted"])
    p.text(cx + 16, cy + 198, 360, 24, "2 / 5 stages · 40%", size=12, color=COLORS["muted"])
    p.button(cx + 432, cy + 214, 146, "Progress જુઓ", primary=False)
    p.note(910, 142, 217, 116, "બીજી Coordinatorની Siteમાં photos/evidence દેખાતા નથી.")
    p.note(910, 284, 217, 116, "Assign, upload, approve અથવા edit controls પણ નહીં.")
    p.note(910, 426, 217, 118, "“Basic progress”માં exact માહિતી કેટલી બતાવવી તે final reviewમાં ચકાસવું.", pending=True)
    pages.append(p)

    p = Page("09", "Supervisor: મારું કામ", "Assigned stagesનો સરળ Android list", "Supervisor · Android")
    mx, my, mw, mh = p.mobile_shell("મારું કામ")
    p.status(mx, my, "આજે / ચાલુ", "info", 104)
    items = [
        ("Foundation", "Sunrise Campus · Shed A", "Shakti Team", "ફોટા ઉમેરો"),
        ("Panel mounting", "Sunrise Campus · Solar Roof", "Uday Team", "સુધારો માંગ્યો"),
        ("Finishing", "Riverfront · Shed", "Shakti Team", "Reviewમાં"),
    ]
    for i, (stage, site, team, status) in enumerate(items):
        yy = my + 44 + i * 116
        p.rect(mx, yy, mw, 102, fill="#FFFFFF", stroke=COLORS["line"], radius=10)
        p.text(mx + 14, yy + 10, mw - 28, 22, stage, size=13, bold=True)
        p.text(mx + 14, yy + 38, mw - 28, 18, site, size=10, color=COLORS["muted"])
        p.text(mx + 14, yy + 62, 150, 18, team, size=10, color=COLORS["muted"])
        p.status(mx + 172, yy + 60, status, "warning" if i == 1 else "info", 114)
    p.note(454, 150, 674, 92, "Supervisor ફક્ત assigned work અને જરૂરી Site/Team context જુએ છે.")
    p.note(454, 266, 674, 92, "Android navigationમાં મુખ્ય કામ, progress અને profile—ત્રણ જ top-level itemsનું sketch.")
    p.note(454, 382, 674, 92, "No GPS permission, no materials section, no offline/sync indicator.")
    p.note(454, 498, 674, 110, "Final language scope નક્કી નથી. અહીં Gujarati review માટે Gujarati labels છે.")
    pages.append(p)

    p = Page("10", "Supervisor: Stage details", "Team contact, progress અને પુરાવા actions એક જગ્યાએ", "Supervisor · Android")
    mx, my, mw, mh = p.mobile_shell("Foundation")
    p.text(mx, my, mw, 22, "Sunrise Campus · Shed A", size=11, color=COLORS["muted"])
    p.status(mx, my + 34, "ચાલુ", "info", 74)
    p.rect(mx, my + 76, mw, 92, fill=COLORS["soft"], stroke="none", radius=8)
    p.text(mx + 14, my + 88, mw - 28, 22, "Shakti Team", size=12, bold=True)
    p.text(mx + 14, my + 116, mw - 28, 20, "Harish Patel · 98••• ••210", size=10, color=COLORS["muted"])
    p.button(mx + 14, my + 142, 122, "Contact જુઓ", primary=False)
    p.text(mx, my + 190, mw, 22, "ફોટા (2 uploaded)", size=12, bold=True)
    p.rect(mx, my + 222, 90, 72, fill=COLORS["soft"], stroke=COLORS["line"], radius=6, label="Photo 1", size=10, align="center")
    p.rect(mx + 104, my + 222, 90, 72, fill=COLORS["soft"], stroke=COLORS["line"], radius=6, label="Photo 2", size=10, align="center")
    p.button(mx, my + 320, mw, "+ ફોટા ઉમેરો")
    p.note(454, 150, 674, 88, "Photo author અને upload સમય historyમાં રહે છે.")
    p.note(454, 262, 674, 88, "ફોટા upload કરવાથી stage complete request આપમેળે નહીં જાય.")
    p.note(454, 374, 674, 88, "Team contact view-only છે; Supervisor edit નહીં કરે.")
    p.note(454, 486, 674, 110, "Stage notes/audio/reminders જેવી જૂની અથવા અસ્પષ્ટ સુવિધા અહીં ઉમેરેલી નથી.")
    pages.append(p)

    p = Page("11", "Online photo upload", "Internet ફરજિયાત; સફળ upload જ evidenceમાં ગણાય", "Android")
    mx, my, mw, mh = p.mobile_shell("ફોટા ઉમેરો")
    p.rect(mx, my, mw, 132, fill=COLORS["soft"], stroke=COLORS["line"], radius=10, dashed=True)
    p.text(mx + 20, my + 24, mw - 40, 28, "Camera / Galleryમાંથી પસંદ કરો", size=12, bold=True, align="center")
    p.text(mx + 20, my + 62, mw - 40, 40, "GPS/location permission જરૂરી નથી", size=10, color=COLORS["muted"], align="center")
    p.rect(mx, my + 154, mw, 72, fill="#FFFFFF", stroke=COLORS["line"], radius=8)
    p.text(mx + 12, my + 166, 150, 20, "foundation-01.jpg", size=10, bold=True)
    p.text(mx + 12, my + 192, 150, 18, "2.4 MB", size=9, color=COLORS["muted"])
    p.status(mx + 188, my + 174, "તૈયાર", "neutral", 96)
    p.button(mx, my + 250, mw, "Upload શરૂ કરો")
    p.note(454, 150, 674, 96, "Upload દરમિયાન સ્પષ્ટ progress/loading બતાવવું; button ફરી tap ન થાય.")
    p.note(454, 270, 674, 96, "Success થયા પછી જ photo evidence listમાં અને completion માટે ગણાય.")
    p.note(454, 390, 674, 96, "Offline save, background queue અથવા automatic sync નથી.")
    p.note(454, 510, 674, 96, "Photo size/type limits requirementsમાં નથી; final design પહેલાં નક્કી કરવાનું.", pending=True)
    pages.append(p)

    p = Page("12", "Stage completion request", "Upload અને completion request બે અલગ actions", "Supervisor · Android")
    mx, my, mw, mh = p.mobile_shell("Completion request")
    p.rect(mx, my, mw, 78, fill=COLORS["green_soft"], stroke="#86EFAC", radius=9)
    p.text(mx + 14, my + 12, mw - 28, 22, "2 photos uploaded", size=12, color=COLORS["green"], bold=True)
    p.text(mx + 14, my + 42, mw - 28, 20, "બંને upload સફળ થયા", size=10, color=COLORS["green"])
    p.text(mx, my + 104, mw, 24, "Stage review માટે મોકલવો?", size=13, bold=True)
    p.text(mx, my + 140, mw, 58, "મોકલ્યા પછી Admin અથવા Site Coordinator evidence review કરશે.", size=10, color=COLORS["muted"])
    p.button(mx, my + 220, mw, "મંજૂરી માટે મોકલો")
    p.button(mx, my + 274, mw, "હમણાં નહીં", primary=False)
    p.note(454, 150, 674, 96, "Supervisor approve કરી શકતો નથી; ફક્ત completion request મોકલે છે.")
    p.note(454, 270, 674, 96, "Interrupted/failed photo આ countમાં દેખાશે નહીં.")
    p.note(454, 390, 674, 96, "Submit પછી clear confirmation અને review status દેખાવું જોઈએ.")
    p.note(454, 510, 674, 96, "Request પાછી ખેંચી શકાય કે નહીં તે હાલ નક્કી નથી.", pending=True)
    pages.append(p)

    p = Page("13", "Admin / Coordinator review", "Evidence જોઈ approve અથવા changes request કરવી", "વેબ + Android")
    cx, cy, cw, ch = p.web_shell("Foundation → Review", active="સાઇટ")
    p.status(cx, cy, "Reviewમાં", "warning", 104)
    p.text(cx + 124, cy + 2, 360, 24, "મોકલનાર: Rakesh Solanki", size=10, color=COLORS["muted"])
    p.rect(cx, cy + 46, 180, 126, fill=COLORS["soft"], stroke=COLORS["line"], radius=6, label="Photo 1\nAuthor + time", size=10, align="center")
    p.rect(cx + 198, cy + 46, 180, 126, fill=COLORS["soft"], stroke=COLORS["line"], radius=6, label="Photo 2\nAuthor + time", size=10, align="center")
    p.rect(cx + 396, cy + 46, 198, 126, fill="#FFFFFF", stroke=COLORS["line"], radius=6,
           label="Assignment\nSupervisor: Rakesh\nTeam: Shakti Team", size=10)
    p.field(cx, cy + 196, 594, "Review નોંધ", "સુધારો માંગો તો કારણ લખો", h=70)
    p.button(cx + 216, cy + 292, 180, "સુધારો માગો", danger=True)
    p.button(cx + 414, cy + 292, 180, "મંજૂર કરો")
    p.note(910, 142, 217, 116, "Admin બધી Sites; Coordinator ફક્ત પોતાની Site review કરે.")
    p.note(910, 284, 217, 116, "Approve અને request changes સ્પષ્ટ અલગ actions છે.")
    p.note(910, 426, 217, 126, "Final stage approval પછી Site auto-complete થાય કે નહીં—નક્કી કરવાનું.", pending=True)
    pages.append(p)

    p = Page("14", "Coordinator absence-cover flow", "Coordinator photos upload કરે અને પછી અલગથી પોતાની submission approve કરી શકે", "Coordinator")
    steps = [
        ("૧", "Teamથી photos મેળવે", "App બહારથી ફોટા મળે"),
        ("૨", "પોતાના નામે upload", "Supervisor બનીને નહીં"),
        ("૩", "Completion request", "Uploadથી auto complete નહીં"),
        ("૪", "અલગ review action", "પોતાની submission approve કરી શકે"),
    ]
    for i, (n, title, body) in enumerate(steps):
        x = 62 + i * 270
        p.rect(x, 184, 222, 178, fill="#FFFFFF", stroke=COLORS["line"], radius=12)
        p.badge(x + 16, 200, 40, 34, n, fill=COLORS["accent_soft"], color=COLORS["accent"])
        p.text(x + 16, 248, 190, 30, title, size=14, bold=True)
        p.text(x + 16, 294, 190, 48, body, size=11, color=COLORS["muted"])
        if i < 3:
            p.line(x + 222, 273, x + 262, 273, color=COLORS["muted"], arrow=True)
    p.rect(62, 412, 1032, 112, fill=COLORS["blue_soft"], stroke="#93C5FD", radius=10)
    p.text(82, 430, 992, 26, "Auditમાં સ્પષ્ટ દેખાવું જોઈએ", size=14, bold=True)
    p.text(82, 466, 992, 34, "Uploaded by: Kavita Shah (Coordinator)  ·  Submitted by: Kavita Shah  ·  Approved by: Kavita Shah", size=12, color=COLORS["muted"])
    p.note(62, 566, 1032, 78, "આ flow Supervisorની impersonation અથવા silent reassignment નથી.")
    pages.append(p)

    p = Page("15", "Assignment handover અને visible history", "Reassignment થાય છતાં જૂનો પુરાવો અને progress જળવાય", "વેબ + Android")
    p.rect(42, 126, 1085, 92, fill="#FFFFFF", stroke=COLORS["line"], radius=10)
    p.text(62, 142, 360, 28, "Foundation · Shed A", size=16, bold=True)
    p.text(62, 178, 520, 22, "Current: Supervisor Mehul · Shakti Team · 60% progress", size=11, color=COLORS["muted"])
    p.button(918, 150, 180, "સોંપણી બદલો")
    rows = [
        ("22 Oct · 11:10", "Supervisor", "Rakesh Solanki", "Mehul Parmar", "Kavita Shah"),
        ("20 Oct · 16:25", "Team", "Uday Team", "Shakti Team", "Admin"),
        ("18 Oct · 09:00", "Supervisor + Team", "—", "Rakesh + Uday", "Admin"),
    ]
    p.text(42, 250, 1085, 26, "Assignment history", size=16, bold=True)
    headers = ["સમય", "શું બદલાયું", "પહેલાં", "હવે", "કોણે બદલ્યું"]
    xs = [42, 222, 430, 650, 888]
    ws = [164, 192, 204, 222, 239]
    for x, w, label in zip(xs, ws, headers):
        p.rect(x, 292, w, 34, fill=COLORS["nav"], stroke=COLORS["nav"], radius=3, label=label, size=10, color="#FFFFFF", bold=True, align="center")
    for ridx, row in enumerate(rows):
        yy = 330 + ridx * 50
        for x, w, value in zip(xs, ws, row):
            p.rect(x, yy, w, 44, fill="#FFFFFF", stroke=COLORS["line"], radius=2, label=value, size=9, align="center")
    p.note(42, 518, 520, 100, "જૂના photos અને work records મૂળ authorના નામે રહે છે.")
    p.note(582, 518, 545, 100, "જેટલી વાર ફેરફાર થાય તેટલી દરેક entry જળવાય.")
    p.note(42, 644, 1085, 72, "Completed stage ફરી ખોલવાની પ્રક્રિયા requirementsમાં નક્કી નથી.", pending=True)
    pages.append(p)

    p = Page("16", "Upload failure અને explicit retry", "Failed upload સફળ તરીકે ન દેખાય અને completion evidenceમાં ન ગણાય", "Android")
    mx, my, mw, mh = p.mobile_shell("ફોટા upload")
    p.rect(mx, my, mw, 86, fill=COLORS["red_soft"], stroke="#FDA29B", radius=9)
    p.text(mx + 14, my + 12, mw - 28, 22, "Upload પૂર્ણ થયો નથી", size=12, color=COLORS["red"], bold=True)
    p.text(mx + 14, my + 40, mw - 28, 32, "Internet connection તપાસો અને ફરી પ્રયાસ કરો.", size=10, color=COLORS["red"])
    p.rect(mx, my + 110, mw, 86, fill="#FFFFFF", stroke=COLORS["line"], radius=8)
    p.text(mx + 12, my + 124, 158, 20, "foundation-03.jpg", size=10, bold=True)
    p.status(mx + 190, my + 124, "Failed", "danger", 92)
    p.text(mx + 12, my + 154, 170, 18, "Evidenceમાં ગણાતો નથી", size=9, color=COLORS["muted"])
    p.button(mx, my + 222, mw, "ફરી upload કરો")
    p.button(mx, my + 276, mw, "આ photo દૂર કરો", primary=False)
    p.note(454, 150, 674, 96, "Errorમાં કારણ + recovery path બંને: connection તપાસો + Retry.")
    p.note(454, 270, 674, 96, "Auto retry/queue નથી; user connected થયા પછી સ્પષ્ટ રીતે retry કરે.")
    p.note(454, 390, 674, 96, "Failed fileને green tick અથવા success toast મળતું નથી.")
    p.note(454, 510, 674, 96, "Retry દરમિયાન upload progress બતાવવો અને duplicate taps અટકાવવા.")
    pages.append(p)

    p = Page("17", "Client સાથે નક્કી કરવાના મુદ્દા", "આ મુદ્દા confirmed feature નથી; final design/development પહેલાં નિર્ણય જોઈએ")
    pending = [
        ("P-01", "Pause / block / reopen", "ચાલુ stage pause કરવો? Completed stage કોણ અને કેવી રીતે reopen કરે?"),
        ("P-02", "Stage dependency", "Shed પૂરું થયા પછી Solar શરૂ થાય જેવી ફરજિયાત શરતો છે?"),
        ("P-03", "Status calculation", "Final stage approvalથી Site auto-complete? Project status કેવી રીતે ગણાય?"),
        ("P-04", "Exact fields", "Project/Site/employee/Team માટે ફરજિયાત field list શું હશે?"),
        ("P-05", "Basic progress detail", "બીજી Coordinatorની linked Siteમાં કેટલું progress detail દેખાડવું?"),
    ]
    for i, (pid, title, body) in enumerate(pending):
        col, row = i % 2, i // 2
        x, y = 42 + col * 548, 126 + row * 176
        p.rect(x, y, 527, 150, fill=COLORS["amber_soft"], stroke="#F59E0B", radius=10)
        p.badge(x + 16, y + 16, 72, 28, pid, fill="#FEF3C7", color=COLORS["amber"])
        p.text(x + 102, y + 14, 405, 32, title, size=14, color=COLORS["amber"], bold=True)
        p.text(x + 16, y + 58, 495, 64, body, size=11, color=COLORS["ink"])
        p.rect(x + 16, y + 122, 495, 1, fill="#FCD34D", stroke="none", radius=0)
    p.note(42, 670, 1075, 72, "Audio notes, reminders, advanced dashboard, bulk action અને password policy હાલની requirementsમાં નથી—તે આપમેળે ઉમેર્યા નથી.")
    pages.append(p)

    return pages


def write_drawio(pages: list[Page]) -> None:
    mxfile = ET.Element("mxfile", {
        "host": "app.diagrams.net", "modified": "2026-10-22T00:00:00.000Z",
        "agent": "Codex review generator", "version": "24.7.17", "type": "device", "compressed": "false"
    })
    for page in pages:
        mxfile.append(page.to_diagram())
    ET.indent(mxfile, space="  ")
    OUT_DRAWIO.write_text('<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(mxfile, encoding="unicode"), encoding="utf-8")


def write_html(pages: list[Page]) -> None:
    font_path = REVIEW / "assets" / "NotoSansGujarati.ttf"
    css_font = font_path.resolve().as_uri()
    sections = "\n".join(f'<section class="sheet">{p.svg_markup()}</section>' for p in pages)
    document = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Site Tracking Client Review v0.4</title>
<style>
@font-face {{ font-family: "Noto Sans Gujarati"; src: url("{css_font}") format("truetype"); font-weight: 100 900; }}
@page {{ size: A4 landscape; margin: 0; }}
* {{ box-sizing: border-box; }}
html, body {{ margin: 0; padding: 0; background: #d7dee8; font-family: Arial, sans-serif; }}
.sheet {{ width: 297mm; height: 210mm; margin: 0 auto 8mm; background: white; page-break-after: always; overflow: hidden; }}
.sheet:last-child {{ page-break-after: auto; }}
svg {{ display: block; width: 100%; height: 100%; }}
@media print {{ body {{ background: white; }} .sheet {{ margin: 0; }} }}
</style></head><body>{sections}</body></html>'''
    OUT_HTML.write_text(document, encoding="utf-8")


def write_manifest(pages: list[Page]) -> None:
    manifest = {
        "version": "0.4",
        "date": "2026-10-22",
        "requirements_source": "docs/requirements-v0.4-working-draft.md",
        "interface_language": "English only",
        "page_count": len(pages),
        "pages": [{"id": p.page_id, "title": p.title, "role": p.role} for p in pages],
        "scope_excluded": ["materials", "GPS/location", "offline/sync", "iOS", "Team login"],
        "pending_decisions_page": "17",
    }
    OUT_MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    REVIEW.mkdir(parents=True, exist_ok=True)
    pages = build_pages()
    write_drawio(pages)
    write_html(pages)
    write_manifest(pages)
    print(f"Generated {len(pages)} pages")
    print(OUT_DRAWIO)
    print(OUT_HTML)


if __name__ == "__main__":
    main()
