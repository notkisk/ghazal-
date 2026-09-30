#!/usr/bin/env python3
"""Append Ecotrack-compatible orders to the cached workbook template.

Usage:
  python scripts/append_ecotrack_orders.py orders.json --output orders.xlsx

The input may be either a list of Ecotrack row dictionaries or a list of the
browser order objects saved by the demo (objects containing ``ecotrackRow``).
The original template is never modified; the output keeps its worksheets,
styles, headers, and exact column order.
"""

from __future__ import annotations

import argparse
import json
import shutil
from copy import deepcopy
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from xml.etree import ElementTree as ET

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
ET.register_namespace("", MAIN_NS)
ET.register_namespace("r", REL_NS)
NS = {"m": MAIN_NS}

COLUMNS = [
    "reference commande", "nom et prenom du destinataire*", "telephone*", "telephone 2",
    "code wilaya*", "wilaya de livraison", "commune de livraison*", "adresse de livraison*",
    "produit*", "poids (kg)", "montant du colis*", "remarque",
    "FRAGILE\n( si oui mettez OUI sinon laissez vide )",
    "ECHANGE\n( si oui mettez OUI sinon laissez vide )",
    "PICK UP\n( si oui mettez OUI sinon laissez vide )",
    "RECOUVREMENT\n( si oui mettez OUI sinon laissez vide )",
    "STOP DESK\n( si oui mettez OUI sinon laissez vide )", "Lien map",
]


def col_name(number: int) -> str:
    result = ""
    while number:
        number, remainder = divmod(number - 1, 26)
        result = chr(65 + remainder) + result
    return result


def as_rows(path: Path) -> list[dict[str, object]]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, list):
        raise ValueError("orders JSON must be an array")
    rows = []
    for item in value:
        row = item.get("ecotrackRow") if isinstance(item, dict) else None
        row = row if isinstance(row, dict) else item
        if not isinstance(row, dict):
            raise ValueError("each order must be a row object or contain ecotrackRow")
        rows.append({column: row.get(column, "") for column in COLUMNS})
    return rows


def cell_value(cell: ET.Element) -> str:
    inline = cell.find("m:is/m:t", NS)
    if inline is not None:
        return inline.text or ""
    value = cell.find("m:v", NS)
    return value.text if value is not None and value.text else ""


def set_cell(cell: ET.Element, value: object) -> None:
    for child in list(cell):
        cell.remove(child)
    text = "" if value is None else str(value)
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        cell.set("t", "n")
        ET.SubElement(cell, f"{{{MAIN_NS}}}v").text = text
    else:
        cell.set("t", "inlineStr")
        inline = ET.SubElement(cell, f"{{{MAIN_NS}}}is")
        ET.SubElement(inline, f"{{{MAIN_NS}}}t").text = text


def append_rows(template: Path, output: Path, rows: list[dict[str, object]]) -> None:
    with ZipFile(template, "r") as source:
        entries = {name: source.read(name) for name in source.namelist()}

    sheet = ET.fromstring(entries["xl/worksheets/sheet1.xml"])
    sheet_data = sheet.find("m:sheetData", NS)
    if sheet_data is None:
        raise ValueError("Ecotrack workbook has no sheet data")
    existing_rows = list(sheet_data.findall("m:row", NS))
    used_rows = []
    for row in existing_rows:
        populated = any(cell_value(cell) for cell in row.findall("m:c", NS))
        if populated:
            used_rows.append(int(row.get("r", "0")))
    start_row = max(used_rows, default=1) + 1
    template_row = next((row for row in existing_rows if int(row.get("r", "0")) == start_row), None)
    if template_row is None:
        template_row = existing_rows[-1] if existing_rows else ET.Element(f"{{{MAIN_NS}}}row")
    template_cells = {}
    for cell in template_row.findall("m:c", NS):
        reference = cell.get("r", "")
        column = "".join(character for character in reference if character.isalpha())
        if column:
            template_cells[column] = cell
    default_style = next(iter(template_cells.values())).get("s", "4") if template_cells else "4"

    row_by_number = {int(row.get("r", "0")): row for row in existing_rows}
    for index, data in enumerate(rows):
        number = start_row + index
        row = deepcopy(template_row)
        row.set("r", str(number))
        for child in list(row):
            if child.tag == f"{{{MAIN_NS}}}c":
                row.remove(child)
        for column_index, column in enumerate(COLUMNS, 1):
            column_name = col_name(column_index)
            cell = deepcopy(template_cells[column_name]) if column_name in template_cells else ET.Element(f"{{{MAIN_NS}}}c", {"s": default_style})
            cell.set("r", f"{col_name(column_index)}{number}")
            set_cell(cell, data[column])
            row.append(cell)
        row_by_number[number] = row

    for child in list(sheet_data):
        sheet_data.remove(child)
    for number in sorted(row_by_number):
        sheet_data.append(row_by_number[number])
    dimension = sheet.find("m:dimension", NS)
    if dimension is not None:
        end_row = max(int(dimension.get("ref", "A1:R1").split(":")[-1][1:]), start_row + len(rows) - 1)
        dimension.set("ref", f"A1:R{end_row}")
    entries["xl/worksheets/sheet1.xml"] = ET.tostring(sheet, encoding="utf-8", xml_declaration=True)

    output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output, "w", ZIP_DEFLATED) as destination:
        for name, content in entries.items():
            destination.writestr(name, content)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("orders", type=Path)
    parser.add_argument("--template", type=Path, default=Path("assets/templates/upload_ecotrack_v31.xlsx"))
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    append_rows(args.template, args.output, as_rows(args.orders))
    print(f"Appended orders to {args.output}")


if __name__ == "__main__":
    main()
