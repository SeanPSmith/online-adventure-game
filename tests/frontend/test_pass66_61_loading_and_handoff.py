"""66.61: route-only loading and deliberate receipt handoff; gameplay untouched."""
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]

def read(path): return (ROOT/path).read_text()

def test_route_fallback_is_theme_aware_and_loaded_before_lazy_pages():
    router=read('frontend/src/router.tsx')
    root=read('frontend/src/layouts/RootLayout.tsx')
    skeleton=read('frontend/src/components/skeleton/RouteSkeleton.tsx')
    entry=read('frontend/src/main.tsx')
    assert 'hydrateFallbackElement: <RouteSkeleton />' in router
    assert '<RouteSkeleton path={navigation.location?.pathname} />' in root
    assert 'import "./styles/inkscapeRouteSkeletonPass6661.css"' in entry
    assert 'useInkboundPaper' in skeleton
    assert 'useAuth' in skeleton
    for page in ('reader', 'collection', 'worlds', 'workspace','public'):
        assert f'"{page}"' in skeleton
    for area in ('skeleton-folio','skeleton-manuscript','skeleton-aside','skeleton-card-grid'):
        assert area in skeleton
    assert 'apiFetch' not in skeleton
    assert 'useGameSocket' not in skeleton

def test_loading_is_not_another_visual_spectacle():
    css=read('frontend/src/styles/inkscapeRouteSkeletonPass6661.css')
    for paper in ('cream','parchment','navy','midnight','phosphor'):
        assert f'data-ink-paper="{paper}"' in css
    assert 'position:fixed;inset:0' in css
    assert 'max-width:650px' in css
    assert 'No shimmer.' in css
    assert 'animation:shimmer' not in css
    assert 'mask-image' not in css

def test_receipt_acknowledges_directly_without_intermediate_page_stage():
    receipt=read('frontend/src/features/adventure/TurnResolutionTheater.tsx')
    flow=read('frontend/src/features/adventure/useTurnTheater.ts')
    assert 'onClick={advanceFromConsequences}' in receipt
    assert 'const advanceFromConsequences = () => onContinue();' in receipt
    assert 'onClick={onContinue}' in receipt
    assert 'setFolioStage("page")' not in receipt
    assert 'q43-chapter-handoff' not in receipt
    assert 'setFolioStage("consequences")' in receipt
    assert 'View consequences' in receipt
    assert 'q6660-resolved-rolls' in receipt
    assert 'acknowledgeResolution' in flow
    assert 'writeAcknowledgedReceipt' in flow

def test_art_contract_is_non_destructive_and_enforces_real_transparency():
    script=read('scripts/audit-inkscape-art-margins.py')
    doc=read('docs/inkscape-asset-contract-66_61.md')
    for token in ('Image.open(', 'getchannel(\'A\')','getbbox()', '--strict','--report'):
        assert token in script
    assert '10%' in doc
    assert 'No opaque/white/beige rectangle' in doc
    assert 'not a deployment gate' in script
    assert 'im.save(' not in script
