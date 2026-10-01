from __future__ import annotations

import subprocess
import sys

from pathlib import Path


# =========================================================
# PATHS
# =========================================================

PROJECT_ROOT = (
    Path(__file__)
    .resolve()
    .parent
)


TEST_DIRECTORY = (
    PROJECT_ROOT
    / "tests"
)


# =========================================================
# DISPLAY
# =========================================================

def print_header(
    title: str,
) -> None:

    print()
    print(
        "=" * 60
    )

    print(
        title
    )

    print(
        "=" * 60
    )

    print()


# =========================================================
# ENVIRONMENT CHECKS
# =========================================================

def check_environment() -> bool:

    print_header(
        "TALES OF TWO — TEST ENVIRONMENT"
    )


    print(
        f"Project root:"
    )

    print(
        PROJECT_ROOT
    )

    print()


    print(
        f"Python:"
    )

    print(
        sys.executable
    )

    print()


    print(
        f"Version:"
    )

    print(
        sys.version.split()[0]
    )

    print()


    if (
        not TEST_DIRECTORY.exists()
    ):

        print(
            "[FAIL] tests/ directory "
            "does not exist."
        )

        return False


    init_file = (
        TEST_DIRECTORY
        / "__init__.py"
    )


    if (
        not init_file.exists()
    ):

        print(
            "[WARN] tests/__init__.py "
            "does not exist."
        )

        print(
            "Creating it now..."
        )


        init_file.touch()


        print(
            "[OK] Created "
            "tests/__init__.py"
        )


    print(
        "[OK] Test environment ready."
    )


    return True


# =========================================================
# TEST RUNNER
# =========================================================

def run_tests() -> int:

    print_header(
        "RUNNING AUTOMATED TESTS"
    )


    command = [

        sys.executable,

        "-m",

        "unittest",

        "discover",

        "-s",
        "tests",

        "-v",
    ]


    print(
        "Command:"
    )

    print(
        " ".join(
            command
        )
    )

    print()


    result = subprocess.run(

        command,

        cwd=
            PROJECT_ROOT,

        check=
            False,
    )


    return (
        result.returncode
    )


# =========================================================
# RESULT
# =========================================================

def print_result(
    return_code: int,
) -> None:

    print()


    if (
        return_code
        == 0
    ):

        print_header(
            "ALL TESTS PASSED"
        )


        print(
            "[OK] The automated test suite "
            "completed successfully."
        )

        print()

        print(
            "Safe to continue development."
        )


    else:

        print_header(
            "TEST FAILURE"
        )


        print(
            "[FAIL] One or more tests failed."
        )

        print()

        print(
            "Do not treat the current state "
            "as known-good until the failures "
            "are understood."
        )


# =========================================================
# MAIN
# =========================================================

def main() -> int:

    if not check_environment():

        return 1


    return_code = (
        run_tests()
    )


    print_result(
        return_code
    )


    return return_code


if __name__ == "__main__":

    raise SystemExit(
        main()
    )