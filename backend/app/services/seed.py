from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.models import User, Form, FormVersion, FormField

SAMPLE_FORMS = [
    {
        "title": "Income certificate request",
        "description": "Used by citizens to obtain family annual income certificate for education, bank loans, and welfare.",
        "fields": [
            {
                "field_name": "applicant_name",
                "data_type": "String",
                "description": "full name of the applicant",
                "required": True,
                "question_en": "What is the applicant's full name?",
                "question_ta": "விண்ணப்பதாரரின் முழு பெயர் என்ன?"
            },
            {
                "field_name": "father_or_guardian_name",
                "data_type": "String",
                "description": "father or guardian name of the applicant",
                "required": True,
                "question_en": "What is your father or guardian's name?",
                "question_ta": "தந்தை அல்லது பாதுகாவலரின் பெயர் என்ன?"
            },
            {
                "field_name": "date_of_birth",
                "data_type": "Date",
                "description": "date of birth in YYYY-MM-DD format",
                "required": True,
                "question_en": "What is your date of birth?",
                "question_ta": "உங்கள் பிறந்த தேதி என்ன?"
            },
            {
                "field_name": "mobile_number",
                "data_type": "Phone",
                "description": "mobile phone number of the applicant",
                "required": True,
                "question_en": "What is your mobile phone number?",
                "question_ta": "உங்கள் கைபேசி எண் என்ன?"
            },
            {
                "field_name": "address",
                "data_type": "String",
                "description": "door number, street, village or town address",
                "required": True,
                "question_en": "What is your residential address including door number, street, and village or town?",
                "question_ta": "கதவு எண், தெரு மற்றும் ஊருடன் உங்கள் குடியிருப்பு முகவரி என்ன?"
            },
            {
                "field_name": "district",
                "data_type": "String",
                "description": "revenue district of residence",
                "required": True,
                "question_en": "Which district do you reside in?",
                "question_ta": "நீங்கள் எந்த மாவட்டத்தில் வசிக்கிறீர்கள்?"
            },
            {
                "field_name": "taluk",
                "data_type": "String",
                "description": "revenue taluk of residence",
                "required": True,
                "question_en": "Which taluk do you belong to?",
                "question_ta": "நீங்கள் எந்த வட்டத்தை (தாலுகா) சேர்ந்தவர்?"
            },
            {
                "field_name": "purpose_of_certificate",
                "data_type": "Choice",
                "description": "purpose for requesting income certificate",
                "required": True,
                "choices": ["Education", "Employment", "Bank loan", "Other"],
                "question_en": "What is the purpose of applying for this certificate?",
                "question_ta": "இந்த சான்றிதழ் தேவைப்படுவதன் நோக்கம் என்ன?"
            },
            {
                "field_name": "occupation",
                "data_type": "String",
                "description": "occupation or trade of the primary earner",
                "required": True,
                "question_en": "What is your primary occupation?",
                "question_ta": "உங்கள் முதன்மை தொழில் என்ன?"
            },
            {
                "field_name": "annual_family_income",
                "data_type": "Number",
                "description": "total yearly income of the family in rupees",
                "required": True,
                "question_en": "What is the total yearly income of the family in rupees?",
                "question_ta": "குடும்பத்தின் மொத்த ஆண்டு வருமானம் ரூபாயில் எவ்வளவு?"
            },
            {
                "field_name": "family_members_count",
                "data_type": "Number",
                "description": "number of members living in the family",
                "required": True,
                "question_en": "How many members are there in your family?",
                "question_ta": "உங்கள் குடும்பத்தில் எத்தனை உறுப்பினர்கள் உள்ளனர்?"
            }
        ]
    },
    {
        "title": "Scholarship application",
        "description": "Post-matric and higher education scholarship assistance application.",
        "fields": [
            {
                "field_name": "student_name",
                "data_type": "String",
                "description": "full name of the student applicant",
                "required": True,
                "question_en": "What is the student's full name?",
                "question_ta": "மாணவரின் முழு பெயர் என்ன?"
            },
            {
                "field_name": "date_of_birth",
                "data_type": "Date",
                "description": "date of birth of the student",
                "required": True,
                "question_en": "What is the student's date of birth?",
                "question_ta": "மாணவரின் பிறந்த தேதி என்ன?"
            },
            {
                "field_name": "gender",
                "data_type": "Choice",
                "description": "gender of the student",
                "required": True,
                "choices": ["Female", "Male", "Other", "Prefer not to say"],
                "question_en": "What is your gender?",
                "question_ta": "உங்கள் பாலினம் என்ன?"
            },
            {
                "field_name": "mobile_number",
                "data_type": "Phone",
                "description": "mobile contact number of the student or parent",
                "required": True,
                "question_en": "What is your mobile contact number?",
                "question_ta": "உங்கள் கைபேசி எண் என்ன?"
            },
            {
                "field_name": "course",
                "data_type": "String",
                "description": "course or degree currently enrolled in",
                "required": True,
                "question_en": "Which course or degree are you studying?",
                "question_ta": "நீங்கள் படிக்கும் படிப்பு அல்லது பட்டம் என்ன?"
            },
            {
                "field_name": "institution_name",
                "data_type": "String",
                "description": "college or university name",
                "required": True,
                "question_en": "What is the name of your educational institution?",
                "question_ta": "உங்கள் கல்வி நிறுவனத்தின் பெயர் என்ன?"
            },
            {
                "field_name": "year_of_study",
                "data_type": "Choice",
                "description": "current year of study",
                "required": True,
                "choices": ["1", "2", "3", "4", "5"],
                "question_en": "Which year of study are you in?",
                "question_ta": "நீங்கள் எந்த கல்வி ஆண்டில் படிக்கிறீர்கள்?"
            },
            {
                "field_name": "previous_year_marks_percentage",
                "data_type": "Number",
                "description": "percentage marks scored in previous academic year",
                "required": True,
                "question_en": "What was your percentage of marks in the previous academic year?",
                "question_ta": "கடந்த கல்வி ஆண்டில் நீங்கள் பெற்ற மதிப்பெண் சதவீதம் என்ன?"
            },
            {
                "field_name": "annual_family_income",
                "data_type": "Number",
                "description": "total annual family income in rupees",
                "required": True,
                "question_en": "What is the total annual income of your family in rupees?",
                "question_ta": "உங்கள் குடும்பத்தின் மொத்த ஆண்டு வருமானம் ரூபாயில் எவ்வளவு?"
            },
            {
                "field_name": "parent_or_guardian_occupation",
                "data_type": "String",
                "description": "occupation of parent or guardian",
                "required": True,
                "question_en": "What is your parent or guardian's occupation?",
                "question_ta": "பெற்றோர் அல்லது பாதுகாவலரின் தொழில் என்ன?"
            }
        ]
    },
    {
        "title": "Old age pension application",
        "description": "Monthly pension welfare assistance for senior citizens.",
        "fields": [
            {
                "field_name": "applicant_name",
                "data_type": "String",
                "description": "full name of the senior applicant",
                "required": True,
                "question_en": "What is your full name?",
                "question_ta": "உங்கள் முழு பெயர் என்ன?"
            },
            {
                "field_name": "age",
                "data_type": "Number",
                "description": "age in completed years",
                "required": True,
                "question_en": "What is your age in completed years?",
                "question_ta": "முழுமையான ஆண்டுகளில் உங்கள் வயது என்ன?"
            },
            {
                "field_name": "gender",
                "data_type": "Choice",
                "description": "gender of the applicant",
                "required": True,
                "choices": ["Female", "Male", "Other", "Prefer not to say"],
                "question_en": "What is your gender?",
                "question_ta": "உங்கள் பாலினம் என்ன?"
            },
            {
                "field_name": "marital_status",
                "data_type": "Choice",
                "description": "marital status of applicant",
                "required": True,
                "choices": ["Single", "Married", "Widowed", "Separated"],
                "question_en": "What is your marital status?",
                "question_ta": "உங்கள் திருமண நிலை என்ன?"
            },
            {
                "field_name": "address",
                "data_type": "String",
                "description": "residential home address in full",
                "required": True,
                "question_en": "What is your complete residential address?",
                "question_ta": "உங்கள் முழுமையான குடியிருப்பு முகவரி என்ன?"
            },
            {
                "field_name": "mobile_number",
                "data_type": "Phone",
                "description": "mobile contact number",
                "required": True,
                "question_en": "What is your contact phone number?",
                "question_ta": "தொடர்பு கொள்ள வேண்டிய தொலைபேசி எண் என்ன?"
            },
            {
                "field_name": "source_of_income",
                "data_type": "String",
                "description": "current source of livelihood or financial support",
                "required": True,
                "question_en": "What is your current source of financial support or livelihood?",
                "question_ta": "தற்போது உங்கள் வாழ்வாதாரம் அல்லது வருமான ஆதாரம் என்ன?"
            },
            {
                "field_name": "monthly_income",
                "data_type": "Number",
                "description": "current monthly income in rupees",
                "required": True,
                "question_en": "What is your approximate monthly income in rupees?",
                "question_ta": "உங்கள் தோராயமான மாத வருமானம் ரூபாயில் எவ்வளவு?"
            },
            {
                "field_name": "lives_alone",
                "data_type": "Boolean",
                "description": "whether the applicant lives alone or with family",
                "required": True,
                "question_en": "Do you live alone?",
                "question_ta": "நீங்கள் தனியாக வசிக்கிறீர்களா?"
            },
            {
                "field_name": "family_members_count",
                "data_type": "Number",
                "description": "number of family members living together",
                "required": True,
                "question_en": "How many members live in your household?",
                "question_ta": "உங்கள் வீட்டில் எத்தனை பேர் வசிக்கிறார்கள்?"
            }
        ]
    },
    {
        "title": "Community certificate request",
        "description": "Application for obtaining official community / caste certificate for educational admissions and welfare schemes.",
        "fields": [
            {
                "field_name": "applicant_name",
                "data_type": "String",
                "description": "full name of the applicant",
                "required": True,
                "question_en": "What is the applicant's full name?",
                "question_ta": "விண்ணப்பதாரரின் முழு பெயர் என்ன?"
            },
            {
                "field_name": "father_or_guardian_name",
                "data_type": "String",
                "description": "father or guardian name",
                "required": True,
                "question_en": "What is your father or guardian's name?",
                "question_ta": "தந்தை அல்லது பாதுகாவலரின் பெயர் என்ன?"
            },
            {
                "field_name": "date_of_birth",
                "data_type": "Date",
                "description": "date of birth in YYYY-MM-DD format",
                "required": True,
                "question_en": "What is your date of birth?",
                "question_ta": "உங்கள் பிறந்த தேதி என்ன?"
            },
            {
                "field_name": "gender",
                "data_type": "Choice",
                "description": "gender of the applicant",
                "required": True,
                "choices": ["Male", "Female", "Transgender"],
                "question_en": "What is your gender?",
                "question_ta": "உங்கள் பாலினம் என்ன?"
            },
            {
                "field_name": "mobile_number",
                "data_type": "Phone",
                "description": "applicant mobile contact number",
                "required": True,
                "question_en": "What is your mobile contact number?",
                "question_ta": "உங்கள் கைபேசி எண் என்ன?"
            },
            {
                "field_name": "address",
                "data_type": "String",
                "description": "residential address including door number and street",
                "required": True,
                "question_en": "What is your complete residential address?",
                "question_ta": "உங்கள் முழு குடியிருப்பு முகவரி என்ன?"
            },
            {
                "field_name": "district",
                "data_type": "String",
                "description": "revenue district of residence",
                "required": True,
                "question_en": "Which district do you reside in?",
                "question_ta": "நீங்கள் எந்த மாவட்டத்தில் வசிக்கிறீர்கள்?"
            },
            {
                "field_name": "taluk",
                "data_type": "String",
                "description": "revenue taluk of residence",
                "required": True,
                "question_en": "Which taluk do you belong to?",
                "question_ta": "நீங்கள் எந்த வட்டத்தை சேர்ந்தவர்?"
            },
            {
                "field_name": "community_category",
                "data_type": "Choice",
                "description": "community category of the applicant",
                "required": True,
                "choices": ["BC", "MBC/DNC", "SC", "ST", "General"],
                "question_en": "Which community category do you belong to?",
                "question_ta": "நீங்கள் எந்த சமூக பிரிவைச் சேர்ந்தவர்?"
            },
            {
                "field_name": "caste_subsect",
                "data_type": "String",
                "description": "sub-caste or sect name",
                "required": True,
                "question_en": "What is your specific caste or subsect name?",
                "question_ta": "உங்கள் குறிப்பிட்ட சாதி அல்லது உட்பிரிவு பெயர் என்ன?"
            }
        ]
    },
    {
        "title": "First graduate certificate application",
        "description": "Fee concession assistance for higher education candidates where no family member is a graduate.",
        "fields": [
            {
                "field_name": "student_name",
                "data_type": "String",
                "description": "full name of the student applicant",
                "required": True,
                "question_en": "What is the student applicant's full name?",
                "question_ta": "விண்ணப்பதாரர் மாணவரின் முழு பெயர் என்ன?"
            },
            {
                "field_name": "father_name",
                "data_type": "String",
                "description": "father's name of the student",
                "required": True,
                "question_en": "What is your father's name?",
                "question_ta": "உங்கள் தந்தையின் பெயர் என்ன?"
            },
            {
                "field_name": "mother_name",
                "data_type": "String",
                "description": "mother's name of the student",
                "required": True,
                "question_en": "What is your mother's name?",
                "question_ta": "உங்கள் தாயின் பெயர் என்ன?"
            },
            {
                "field_name": "date_of_birth",
                "data_type": "Date",
                "description": "date of birth in YYYY-MM-DD format",
                "required": True,
                "question_en": "What is your date of birth?",
                "question_ta": "உங்கள் பிறந்த தேதி என்ன?"
            },
            {
                "field_name": "mobile_number",
                "data_type": "Phone",
                "description": "contact mobile number",
                "required": True,
                "question_en": "What is your contact mobile phone number?",
                "question_ta": "உங்கள் கைபேசி எண் என்ன?"
            },
            {
                "field_name": "address",
                "data_type": "String",
                "description": "permanent address of the family",
                "required": True,
                "question_en": "What is your permanent residential address?",
                "question_ta": "உங்கள் நிரந்தர குடியிருப்பு முகவரி என்ன?"
            },
            {
                "field_name": "district",
                "data_type": "String",
                "description": "home district",
                "required": True,
                "question_en": "Which is your home district?",
                "question_ta": "உங்கள் சொந்த மாவட்டம் எது?"
            },
            {
                "field_name": "college_name",
                "data_type": "String",
                "description": "name of the college or university admitted to",
                "required": True,
                "question_en": "Which college or university have you joined or applied to?",
                "question_ta": "நீங்கள் சேர்ந்துள்ள அல்லது விண்ணப்பித்துள்ள கல்லூரி பெயர் என்ன?"
            },
            {
                "field_name": "degree_course",
                "data_type": "String",
                "description": "degree program or course enrolled in",
                "required": True,
                "question_en": "Which degree course are you pursuing?",
                "question_ta": "நீங்கள் படிக்கும் பட்டப்படிப்பு எது?"
            },
            {
                "field_name": "family_members_count",
                "data_type": "Number",
                "description": "total count of family members",
                "required": True,
                "question_en": "How many members are in your immediate family?",
                "question_ta": "உங்கள் குடும்பத்தில் மொத்தம் எத்தனை உறுப்பினர்கள் உள்ளனர்?"
            }
        ]
    },
    {
        "title": "Public grievance petition",
        "description": "Submit civic complaints regarding water, roads, street lighting, sanitation, or electricity to municipal authorities.",
        "fields": [
            {
                "field_name": "petitioner_name",
                "data_type": "String",
                "description": "full name of the citizen submitting grievance",
                "required": True,
                "question_en": "What is your full name?",
                "question_ta": "உங்கள் முழு பெயர் என்ன?"
            },
            {
                "field_name": "mobile_number",
                "data_type": "Phone",
                "description": "contact phone number for updates",
                "required": True,
                "question_en": "What is your mobile number for SMS status updates?",
                "question_ta": "நிலை தகவல் பெற உங்கள் கைபேசி எண் என்ன?"
            },
            {
                "field_name": "email",
                "data_type": "Email",
                "description": "email address for official correspondence",
                "required": True,
                "question_en": "What is your email address?",
                "question_ta": "உங்கள் மின்னஞ்சல் முகவரி என்ன?"
            },
            {
                "field_name": "locality_or_ward",
                "data_type": "String",
                "description": "street, village, ward or municipality locality",
                "required": True,
                "question_en": "Which locality, village, or ward does this grievance pertain to?",
                "question_ta": "இந்த குறை எந்த பகுதி, கிராமம் அல்லது வார்டை சார்ந்தது?"
            },
            {
                "field_name": "grievance_category",
                "data_type": "Choice",
                "description": "category of the grievance",
                "required": True,
                "choices": ["Drinking water", "Road repair", "Street lighting", "Sanitation & Waste", "Electricity", "Other civic issue"],
                "question_en": "Which category best describes your grievance?",
                "question_ta": "உங்கள் குறை எந்த வகையைச் சேர்ந்தது?"
            },
            {
                "field_name": "grievance_description",
                "data_type": "String",
                "description": "detailed description of the issue or complaint",
                "required": True,
                "question_en": "Please describe the problem and its exact location.",
                "question_ta": "பிரச்சனை மற்றும் அதன் சரியான இடத்தை விவரிக்கவும்."
            }
        ]
    }
]

async def seed_sample_forms(db: AsyncSession):
    if not settings.SEED_SAMPLE_FORMS:
        return

    admin_res = await db.execute(select(User).where(User.role == "admin"))
    admin_user = admin_res.scalar_one_or_none()
    if not admin_user:
        user_res = await db.execute(select(User))
        admin_user = user_res.scalars().first()
    
    if not admin_user:
        from app.security import hash_password
        admin_user = User(
            email=settings.ADMIN_EMAIL.lower().strip(),
            hashed_password=hash_password(settings.ADMIN_PASSWORD),
            role="admin"
        )
        db.add(admin_user)
        await db.flush()

    admin_id = admin_user.id

    for s_form in SAMPLE_FORMS:
        res = await db.execute(select(Form).where(Form.title == s_form["title"]))
        existing = res.scalar_one_or_none()
        if existing:
            continue

        form = Form(
            title=s_form["title"],
            description=s_form["description"],
            status="published",
            allow_document_upload=True,
            created_by=admin_id
        )
        db.add(form)
        await db.flush()

        ver = FormVersion(form_id=form.id, version_number=1)
        db.add(ver)
        await db.flush()

        for idx, fdict in enumerate(s_form["fields"]):
            field = FormField(
                form_version_id=ver.id,
                field_name=fdict["field_name"],
                data_type=fdict["data_type"],
                description=fdict["description"],
                required=fdict.get("required", True),
                position=idx,
                choices=fdict.get("choices"),
                question_en=fdict["question_en"],
                question_ta=fdict["question_ta"]
            )
            db.add(field)

        await db.commit()
        print(f"[Seed] Created published sample citizen service form: {s_form['title']}")
    return len(SAMPLE_FORMS)

seed_citizen_service_forms = seed_sample_forms
