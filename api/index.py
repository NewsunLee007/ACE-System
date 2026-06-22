from pathlib import Path
import sys


def _find_backend_dir() -> Path:
    current_file = Path(__file__).resolve()
    candidates = []
    for parent in (current_file.parent, *current_file.parents):
        candidates.append(parent / "new-century-edudata" / "backend")
        candidates.append(parent / "backend")

    for candidate in candidates:
        if (candidate / "main.py").exists():
            return candidate

    checked = ", ".join(str(candidate) for candidate in candidates[:12])
    raise RuntimeError(f"Backend directory not found for Vercel function. Checked: {checked}")


BACKEND_DIR = _find_backend_dir()
sys.path.insert(0, str(BACKEND_DIR))

from main import app  # noqa: E402
