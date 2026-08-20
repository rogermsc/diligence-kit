"""Both LibreOffice call sites must agree about the binary's name.

They did not. The renderer resolved it; the extractor hardcoded "libreoffice",
which Debian installs and macOS does not — so uploading a .docx worked in the
container and failed on a laptop, while the report it would have produced
converted fine either way.

The last test is the one that matters: it fails if a third call site hardcodes
a name, or if either of these two stops going through the helper.
"""

import pathlib
import shutil

from src.core import soffice

AGENT = pathlib.Path(__file__).resolve().parents[1]


def test_prefers_soffice_where_it_exists(monkeypatch):
    monkeypatch.setattr(shutil, "which", lambda name: "/opt/homebrew/bin/soffice"
                        if name == "soffice" else None)
    assert soffice.binary() == "soffice"


def test_falls_back_to_the_debian_name(monkeypatch):
    # The container: libreoffice-writer, no soffice on PATH.
    monkeypatch.setattr(shutil, "which", lambda name: None)
    assert soffice.binary() == "libreoffice"


def test_no_source_file_names_a_libreoffice_binary_directly():
    offenders = []
    for path in (AGENT / "src").rglob("*.py"):
        if path.name == "soffice.py":
            continue
        for i, line in enumerate(path.read_text().splitlines(), start=1):
            if line.lstrip().startswith("#"):
                continue
            if '"soffice"' in line or '"libreoffice"' in line:
                offenders.append(f"{path.relative_to(AGENT)}:{i}: {line.strip()}")

    assert offenders == [], (
        "these name a LibreOffice binary instead of calling soffice.binary(); "
        "one of them will be wrong on some machine:\n  " + "\n  ".join(offenders)
    )
