"""Protect the guided Hero Creator without prescribing its layout markup."""
from pathlib import Path
PROJECT = Path(__file__).resolve().parents[2]

def src(path): return (PROJECT / path).read_text(encoding='utf-8')

def test_hero_creation_uses_curated_questions_not_unbounded_appearance_fields():
    page=src('frontend/src/pages/heroes/HeroCreatePage.tsx')
    questions=src('frontend/src/pages/heroes/heroQuestionnaire.ts')
    for token in ('APPEARANCE_CHAPTERS','PERSONALITY_QUESTIONS','appearanceComplete','quizProfile','quizPage','identityPage','aria-pressed', 'role="group"'):
        assert token in page
    assert 'species' in questions and 'gender' in questions and 'motivation' in questions
    assert 'Personal' not in page or 'PERSONALITY_QUESTIONS' in page
    assert 'type="text"' in page   # Hero name remains editable
    assert 'textarea' in page      # Biography remains reviewable
    assert 'Species / ancestry" value=' not in page
    assert '<select' not in page

def test_original_rule_and_portrait_flows_are_intact():
    page=src('frontend/src/pages/heroes/HeroCreatePage.tsx')
    sheet=src('frontend/src/pages/heroes/HeroSheetPage.tsx')
    for name in ('getCreationRules','suggestedBuild','validPoints','proposeHeroBiography','createCharacter(','generateHeroPortrait','chooseHeroPortrait'):
        assert name in page
    assert 'portraitBook?.selected_attempt' in sheet
    assert 'qh46-sheet-pfp' in sheet
    assert 'qh46-pfp-frame' in page
    assert 'candidate.url' in page and '3' in page

def test_scoped_inkspace_css_and_accessible_states():
    css=src('frontend/src/pages/heroes/quillairoHeroQuizPass6646.css')
    assert '.quill-hero-creator' in css
    assert '[aria-pressed="true"]' in css
    assert '@media(max-width:760px)' in css
    assert 'prefers-reduced-motion' in css
    assert 'var(--qh-rule)' in css
