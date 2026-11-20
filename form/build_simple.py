from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

OUT = "/home/claude/Self_Understanding_Survey_XLSForm.xlsx"
COLS = ["type", "name", "label", "hint", "required", "relevant", "constraint", "constraint_message", "appearance", "choice_filter", "calculation"]
survey = []
def row(**kw): survey.append(kw)

AGE_OK = "(${age_group} = '18–24' or ${age_group} = '25–34' or ${age_group} = '35–44' or ${age_group} = '45–50')"
ELIG = f"{AGE_OK} and ${{lives_rwanda}} = 'Yes' and ${{consent}} = 'I agree and wish to continue'"

row(type="start", name="start")
row(type="end", name="end")

# Introduction
row(type="begin_group", name="intro", label="Introduction", appearance="field-list")
row(type="note", name="intro_title",
    label="## Knowing and Living the Self\nAn Anonymous Survey of Adults Aged 18–50")
row(type="note", name="intro_purpose",
    label="**Purpose:** This survey explores how adults understand themselves, recognise personal patterns, "
          "respond to feedback, and experience the relationship between their values and behaviour.")
row(type="note", name="intro_info",
    label="You are invited to participate in an anonymous research survey about self-understanding and personal "
          "reflection among adults aged 18–50. The survey should take approximately 10–15 minutes.\n\n"
          "This is not a test of maturity, emotional intelligence, or whether you are a “good” or “self-aware” person. "
          "Everyone understands themselves clearly in some situations and less clearly in others.\n\n"
          "Some questions describe ordinary experiences such as becoming defensive, avoiding uncomfortable information, "
          "repeating a pattern, or acting differently from one’s values. There are no perfect answers. Please select what "
          "most closely reflects what usually happens in your life, not what sounds most admirable.\n\n"
          "When answering, think mainly about your experiences during the **past six months**.\n\n"
          "Please do not include information that could identify you or another person in your written response.")
row(type="end_group", name="intro")

# Section A
row(type="begin_group", name="section_a", label="Section A: Eligibility and Consent")
row(type="select_one age", name="age_group", label="1. What is your age group?", required="yes")
row(type="note", name="not_eligible_age",
    label="Thank you for your interest. This survey is only for adults aged 18–50. Please submit the form to finish.",
    relevant=f"${{age_group}} != '' and not({AGE_OK})")
row(type="select_one yesno", name="lives_rwanda", label="2. Do you currently live in Rwanda?",
    required="yes", relevant=AGE_OK)
row(type="note", name="not_eligible_rwanda",
    label="Thank you for your interest. This survey is only for adults living in Rwanda. Please submit the form to finish.",
    relevant="${lives_rwanda} = 'No'")
row(type="note", name="consent_text",
    label="**By selecting “I agree,” you confirm that:**\n"
          "- you have read the participant information;\n"
          "- you understand that participation is voluntary;\n"
          "- you understand that you may leave before submitting;\n"
          "- you are aged 18–50 and currently live in Rwanda;\n"
          "- you understand that submitted anonymous responses may not be withdrawable;\n"
          "- and you voluntarily agree to participate.",
    relevant="${lives_rwanda} = 'Yes'")
row(type="select_one consent", name="consent", label="3. Do you voluntarily agree to participate?",
    required="yes", relevant="${lives_rwanda} = 'Yes'")
row(type="note", name="no_consent",
    label="Thank you. You have chosen not to participate. Please submit the form to close it.",
    relevant="${consent} = 'I do not agree'")
row(type="end_group", name="section_a")

# Section B
row(type="begin_group", name="section_b", label="Section B: Your Current Life Context",
    appearance="field-list", relevant=ELIG)
row(type="note", name="section_b_note",
    label="These questions provide context for interpreting the findings. They are not intended to define your identity.")
SEL = lambda q, o: f"selected(${{{q}}}, '{o}')"
MOTHER = f"({SEL('primary_activity','Working_Mother')} or {SEL('primary_activity','Stay_home_mother')})"
FATHER = f"({SEL('primary_activity','Working_Father')} or {SEL('primary_activity','Stay_home_Father')})"
EMPLOYED = "(selected(., 'Employed_full-time') or selected(., 'Employed_part-time') or selected(., 'Self-employed_or_running_a_business'))"
STAYHOME = "(selected(., 'Stay_home_mother') or selected(., 'Stay_home_Father'))"
row(type="select_multiple activity", name="primary_activity",
    label="4. What is your current primary activity?", hint="Select all that apply.", required="yes",
    constraint=("not((selected(., 'Working_Mother') or selected(., 'Stay_home_mother')) and (selected(., 'Working_Father') or selected(., 'Stay_home_Father')))"
                " and not(selected(., 'Working_Mother') and selected(., 'Stay_home_mother'))"
                " and not(selected(., 'Working_Father') and selected(., 'Stay_home_Father'))"
                f" and not({STAYHOME} and {EMPLOYED})"
                f" and not(selected(., 'Unemployed_and_looking_for_work') and {EMPLOYED})"),
    constraint_message="Some of these answers cannot all be true. See the red message below the question.")
WARN = '⚠️ {}'
row(type="note", name="warn_mother_father", relevant=f"{MOTHER} and {FATHER}",
    label=WARN.format("Please choose either the **mother** options or the **father** options, not both."))
row(type="note", name="warn_work_stay", relevant=(f"({SEL('primary_activity','Working_Mother')} and {SEL('primary_activity','Stay_home_mother')}) or "
                                                   f"({SEL('primary_activity','Working_Father')} and {SEL('primary_activity','Stay_home_Father')})"),
    label=WARN.format("**Working** parent and **stay-home** parent cannot both apply. Please keep only one."))
row(type="note", name="warn_stay_employed",
    relevant=(f"({SEL('primary_activity','Stay_home_mother')} or {SEL('primary_activity','Stay_home_Father')}) and "
              f"({SEL('primary_activity','Employed_full-time')} or {SEL('primary_activity','Employed_part-time')} or {SEL('primary_activity','Self-employed_or_running_a_business')})"),
    label=WARN.format("A **stay-home** parent is not also employed or self-employed. If you work, choose **Working mother/father** instead."))
row(type="note", name="warn_unemployed",
    relevant=(f"{SEL('primary_activity','Unemployed_and_looking_for_work')} and "
              f"({SEL('primary_activity','Employed_full-time')} or {SEL('primary_activity','Employed_part-time')} or {SEL('primary_activity','Self-employed_or_running_a_business')})"),
    label=WARN.format("**Unemployed** cannot be combined with employed or self-employed."))
row(type="text", name="primary_activity_other", label="Please specify the other activity.",
    required="yes", relevant="selected(${primary_activity}, 'Other')")
row(type="calculate", name="parent_role", calculation=f"if({MOTHER} or {FATHER}, '1', '0')")
REL = ["I_am_single", "I_am_dating_or_in_a_relationship", "I_am_married", "I_am_separated_divorced_or_widowed"]
row(type="select_multiple circumstance", name="current_circumstances",
    label="5. Which of the following currently applies to you?",
    hint="Select all that apply. Choose only one relationship status (single, dating/in a relationship, married, or separated/divorced/widowed).",
    required="yes",
    choice_filter="${parent_role} = '0' or name != 'None_of_these_reflects_my_current_circumstances'",
    constraint=("not(selected(., 'None_of_these_reflects_my_current_circumstances') and count-selected(.) > 1)"
                " and (" + " + ".join(f"number(selected(., '{r}'))" for r in REL) + ") <= 1"
                " and (${parent_role} = '0' or selected(., 'I_am_a_parent'))"),
    constraint_message="Please check your answers: choose only one relationship status; ‘None of these’ cannot be combined with other options; and if you are a mother or father, please also select ‘I am a parent’.")
row(type="note", name="hint_parent", relevant="${parent_role} = '1' and not(selected(${current_circumstances}, 'I_am_a_parent'))",
    label='ℹ️ You said you are a mother or father in Q4, so please also select **I am a parent**.')
row(type="note", name="warn_relationship",
    relevant="(" + " + ".join(f"number(selected(${{current_circumstances}}, '{r}'))" for r in REL) + ") > 1",
    label=WARN.format("Please choose only **one** relationship status."))
row(type="end_group", name="section_b")

# Section C: statements
statements = [
    "When someone asks me to describe who I am, I find it difficult to know what to say beyond my roles, responsibilities, or achievements.",
    "When I imagine losing an important role, such as my job, relationship, or position in the family, I am unsure what would remain of my identity.",
    "My understanding of who I am changes considerably depending on what other people say or think about me.",
    "After making an important decision, I sometimes wonder, “Did I genuinely want this, or was I influenced by what others expected?”",
    "I can recognise the qualities that make me different from people around me without needing to see myself as better or worse than them.",
    "I notice that I present very different versions of myself depending on whether I am with family, friends, colleagues, or other groups.",
    "I sometimes copy how other people speak, dress, behave, or express opinions because I want to feel accepted.",
    "What I say I want can change depending on who I am talking to at the time.",
    "I have made important choices in relationships, work, or life mainly because I did not want to disappoint someone.",
    "Even when my opinion is unpopular, I can recognise which thoughts and beliefs are genuinely my own.",
    "I can identify my strengths and limitations without needing someone else to point them out first.",
    "When someone criticises me, my first reaction is usually to defend myself rather than consider whether the criticism may be useful.",
    "I try to appear strong and in control, even when I am struggling, uncertain, or in need of help.",
    "When someone describes me in a way I do not recognise, I can pause and examine their perspective before accepting or rejecting it.",
    "I can admit that I was wrong without feeling that the mistake defines who I am.",
    "I can name the personal values that guide my decisions and explain why those values matter to me.",
    "Looking back at my recent choices, my actions generally reflect the values I say are important to me.",
    "When my behaviour goes against my values, I can recognise the inconsistency instead of immediately justifying it.",
    "I can usually identify what triggered a strong emotion, such as anger, frustration, fear, jealousy, excitement, or happiness.",
    "I intentionally make time to examine my choices, emotions, and recurring patterns, even when no one else will know that I have done so.",
    "When I am in an argument, I can easily know if it is to protect my values or to protect my pride.",
]
pages = [(1, 5), (6, 10), (11, 15), (16, 18), (19, 21)]
for p, (a, b) in enumerate(pages, start=1):
    row(type="begin_group", name=f"section_c_{p}", label="Section C: How I See Myself",
        appearance="field-list", relevant=ELIG)
    row(type="note", name=f"section_c_note_{p}",
        label="How much do you agree or disagree with each statement? Think about the past six months.")
    for i in range(a, b + 1):
        row(type="select_one agree", name=f"q{i + 5}", label=f"{i + 5}. {statements[i - 1]}",
            required="yes", appearance="likert")
    row(type="end_group", name=f"section_c_{p}")

row(type="begin_group", name="closing", label="Final comments", appearance="field-list", relevant=ELIG)
row(type="text", name="comments",
    label="27. Is there anything else you would like to share? (Optional)",
    hint="Please do not include names or details that could identify you or anyone else.",
    appearance="multiline")
row(type="note", name="thank_you", label="**Thank you for taking part.** Please press Submit to send your responses.")
row(type="end_group", name="closing")

# Choices: select_one -> exact text; select_multiple -> text with underscores (spaces not allowed)
choices = []
def one(lst, labels):
    for l in labels: choices.append(dict(list_name=lst, name=l, label=l))
def multi(lst, labels):
    for l in labels: choices.append(dict(list_name=lst, name=l.replace(" ", "_").replace(",", ""), label=l))

one("age", ["Under 18", "18–24", "25–34", "35–44", "45–50", "Over 50", "Prefer not to say"])
one("yesno", ["Yes", "No"])
one("consent", ["I agree and wish to continue", "I do not agree"])
multi("activity", ["Studying", "Employed full-time", "Employed part-time", "Self-employed or running a business",
                   "Unemployed and looking for work", "Working Mother", "Stay home mother", "Working Father",
                   "Stay home Father", "Other"])
multi("circumstance", ["I am single", "I am dating or in a relationship", "I am married",
                       "I am separated divorced or widowed", "I am a parent",
                       "I have significant caregiving responsibilities",
                       "I am experiencing a major educational or career transition",
                       "I am experiencing another significant personal transition",
                       "None of these reflects my current circumstances"])
# fix label punctuation for display only
for c in choices:
    if c["label"] == "I am separated divorced or widowed":
        c["label"] = "I am separated, divorced, or widowed"
one("agree", ["Strongly agree", "Agree", "Disagree", "Strongly disagree", "Not sure"])

settings = [dict(form_title="Knowing and Living the Self: An Anonymous Survey of Adults Aged 18–50",
                 form_id="knowing_living_self", version="2026112004", style="pages")]

wb = Workbook()
HF = Font(name="Arial", bold=True, color="FFFFFF"); HFILL = PatternFill("solid", start_color="1F4E79")
thin = Side(style="thin", color="BFBFBF"); B = Border(left=thin, right=thin, top=thin, bottom=thin)
GFILL = PatternFill("solid", start_color="DDEBF7")
def write(ws, headers, rows, widths):
    ws.append(headers)
    for r in rows: ws.append([r.get(h, "") for h in headers])
    for c in ws[1]: c.font, c.fill = HF, HFILL
    for rr in ws.iter_rows(min_row=2):
        grp = str(rr[0].value).startswith(("begin_group", "end_group"))
        for c in rr:
            c.font = Font(name="Arial", size=10, bold=grp); c.border = B
            c.alignment = Alignment(vertical="top", wrap_text=True)
            if grp: c.fill = GFILL
    for i, w in enumerate(widths, 1): ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"

ws = wb.active; ws.title = "survey"
write(ws, COLS, survey, [24, 22, 75, 30, 9, 40, 35, 35, 14])
write(wb.create_sheet("choices"), ["list_name", "name", "label"], choices, [16, 55, 55])
write(wb.create_sheet("settings"), list(settings[0]), settings, [60, 22, 14, 10])
wb.save(OUT); print("ok", len(survey), len(choices))
