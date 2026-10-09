from tests.support import PROJECT_ROOT
from pathlib import Path

ROOT = PROJECT_ROOT
FRONTEND = ROOT / "frontend" / "src"


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_public_home_explains_product_and_primary_paths() -> None:
    home = read("frontend/src/pages/public/PublicHomePage.tsx")

    assert "AI-DIRECTED TEXT ADVENTURE // ONE OR TWO PLAYERS" in home
    assert 'to="/game">PLAY' in home
    assert 'to="/game/heroes/new">CREATE HERO' in home
    assert 'to="/login">SIGN IN' in home
    assert "SOLO MODE" in home
    assert "CO-OP MODE" in home
    assert 'id="how-it-works"' in home
    assert "The server owns the mechanics" in home


def test_public_shell_has_real_navigation_footer_and_build_fingerprint() -> None:
    shell = read("frontend/src/layouts/PublicLayout.tsx")
    deploy = read("scripts/aws/deploy-frontend-assets.sh")

    assert "public-menu-toggle" in shell
    assert "HOW IT WORKS" in shell
    assert 'to="/rulebook"' in shell
    assert "PRIVACY" in shell
    assert "TERMS" in shell
    assert "FEEDBACK" in shell
    assert "BUILD // {BUILD_ID}" in shell
    assert "VITE_BUILD_ID" in deploy
    assert "git -C \"$ROOT_DIR\" rev-parse --short HEAD" in deploy


def test_rulebook_is_available_in_public_shell() -> None:
    router = read("frontend/src/router.tsx")
    public_block = router.split('element: <PublicLayout />', 1)[1].split('element: <RequireAuth />', 1)[0]

    # Pass 49 moved the Rulebook to a lazy route. Verify the anonymous/public
    # branch still resolves the actual Rulebook page (not just a matching URL).
    public_rulebook_routes = [
        line.strip() for line in public_block.splitlines() if 'path: "rulebook"' in line
    ]
    assert len(public_rulebook_routes) == 1
    assert 'lazy:' in public_rulebook_routes[0]
    assert 'import("./pages/game/RulebookPage")' in public_rulebook_routes[0]
    assert '.RulebookPage' in public_rulebook_routes[0]


def test_auth_pages_share_intentional_public_shell_language() -> None:
    login = read("frontend/src/pages/auth/LoginPage.tsx")
    register = read("frontend/src/pages/auth/RegisterPage.tsx")
    recovery = read("frontend/src/pages/auth/ForgotPasswordPage.tsx")

    assert 'className="auth-shell"' in login
    assert 'className="auth-shell"' in register
    assert 'className="auth-shell"' in recovery
    assert "RETURN PATH SAVED" in login
    assert "DESTINATION SAVED" in register
    assert "does not collect or pretend to send an email" in recovery


def test_public_shell_has_phone_first_responsive_rules() -> None:
    styles = read("frontend/src/styles/layout.css")

    assert "PUBLIC PRODUCT SHELL // PASS 29B" in styles
    assert "@media (max-width: 760px)" in styles
    assert ".public-nav.is-open" in styles
    assert ".home-primary-actions .button" in styles
    assert ".auth-shell" in styles
