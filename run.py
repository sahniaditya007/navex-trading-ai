"""
NAVEX Trading AI - Quick Launcher.
Convenience entrypoint to launch the web dashboard server, run the terminal demo,
or execute the pytest test suite.
"""

import sys
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = ROOT_DIR / "backend"

if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def main():
    if "--test" in sys.argv:
        print("Running NAVEX test suite...")
        import os
        env = os.environ.copy()
        env["PYTHONPATH"] = str(BACKEND_DIR)
        cmd = [sys.executable, "-m", "pytest", str(BACKEND_DIR / "tests"), "-v"]
        subprocess.run(cmd, env=env)

    elif "--demo" in sys.argv:
        from cli import run_demo_simulation
        run_demo_simulation()
    elif "--web" in sys.argv:
        web_dir = ROOT_DIR / "web"
        print("=" * 65)
        print("Starting NAVEX Trading AI Next.js 16 Precision Dashboard...")
        print(f"URL: http://localhost:3000/")
        print("=" * 65)
        subprocess.run(["npm", "run", "dev"], cwd=str(web_dir), shell=True)
    else:
        import uvicorn
        from core.config import settings
        print("=" * 65)
        print("Starting NAVEX Trading AI Web Server...")
        print(f"URL: http://{settings.HOST}:{settings.PORT}/")
        print(f"Docs: http://{settings.HOST}:{settings.PORT}/docs")
        print(f"Mode: Simulated Paper Trading (Initial Capital: ${settings.INITIAL_CAPITAL:,.2f})")
        print("=" * 65)
        uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)


if __name__ == "__main__":
    main()
