from tests.support import PROJECT_ROOT
from pathlib import Path

ROOT = PROJECT_ROOT
FRONTEND = ROOT / "frontend" / "src"


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def test_public_home_explains_product_and_primary_paths() -> None:
    home = read("frontend/src/pages/public/PublicHomePage.tsx")
    assert "A living storybook" in home
    assert "A LIVING STORYBOOK" in home
    assert 'id="how-it-works"' in home
    assert 'id="worlds"' in home
    assert 'id="story-preview"' in home
    assert 'authenticated ? "/game" : "/register"' in home
    assert 'to="/game"' in home
    assert 'setSampleChoice(index)' in home
    assert 'AN INTERACTIVE SAMPLE' in home
    assert 'dice decide the risk' in home
    assert 'ART}home-vista.png' in home


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
    frame = read("frontend/src/pages/auth/QuillairoAuthFrame.tsx")
    assert "QuillairoAuthFrame" in login and "QuillairoAuthFrame" in register and "QuillairoAuthFrame" in recovery
    assert 'await login(identifier, password)' in login
    assert 'state?.returnTo ?? "/game"' in login
    assert 'await register(email, username, password)' in register
    assert 'state: { returnTo: state?.returnTo }' in register
    assert "No email has been requested or sent" in recovery
    assert 'auth-journey.png' in frame
    assert 'aria-label={title}' in frame


def test_public_shell_has_phone_first_responsive_rules() -> None:
    styles = read("frontend/src/styles/layout.css")

    assert "PUBLIC PRODUCT SHELL // PASS 29B" in styles
    assert "@media (max-width: 760px)" in styles
    assert ".public-nav.is-open" in styles
    assert ".home-primary-actions .button" in styles
    assert ".auth-shell" in styles
