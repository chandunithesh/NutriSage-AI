# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║           AI-POWERED NUTRITION AGENT — IBM Watsonx.ai + Granite             ║
║                        Flask Backend  •  app.py                             ║
╚══════════════════════════════════════════════════════════════════════════════╝

HOW TO RUN
  1. Copy .env.example → .env and fill in your credentials
  2. pip install -r requirements.txt
  3. python app.py
"""

import os
import json
import logging
from datetime import datetime, timezone
from flask import Flask, request, jsonify, render_template, session
from flask_cors import CORS
from dotenv import load_dotenv
try:
    from ibm_watsonx_ai import APIClient, Credentials
    from ibm_watsonx_ai.foundation_models import ModelInference
    from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams
    _SDK_AVAILABLE = True
except ImportError:
    _SDK_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("ibm-watsonx-ai not installed — running in demo mode.")

# ─────────────────────────────────────────────────────────────────────────────
#  AGENT INSTRUCTIONS  ← Customise everything about the agent here
# ─────────────────────────────────────────────────────────────────────────────
AGENT_INSTRUCTIONS = {

    # ── Identity & Tone ──────────────────────────────────────────────────────
    "name": "NutriSage",
    "persona": (
        "You are NutriSage, a warm, knowledgeable, and encouraging AI nutrition "
        "coach. You speak in a friendly yet professional tone — like a trusted "
        "dietitian who genuinely cares about the user's wellbeing. Keep answers "
        "concise but thorough. Use bullet points and clear sections when listing "
        "foods or plans. Always end with a short motivational note."
    ),

    # ── Diet Specialisation ──────────────────────────────────────────────────
    "diet_focus": [
        "Balanced Indian vegetarian & non-vegetarian diets",
        "Diabetic-friendly and low-glycaemic-index meals",
        "Heart-healthy, low-sodium, low-cholesterol plans",
        "Weight-loss (calorie-deficit) and muscle-gain plans",
        "Lactation and prenatal nutrition",
        "Child and adolescent nutrition",
        "Senior-citizen nutrition with joint and bone health focus",
    ],

    # ── Indian Food Preferences ──────────────────────────────────────────────
    "indian_food_context": (
        "Prioritise Indian food staples: dal, sabzi, roti, rice, idli, dosa, "
        "poha, upma, khichdi, curd, lassi, chaas, paneer, rajma, chole, "
        "seasonal vegetables (lauki, tori, karela, palak, methi), millets "
        "(jowar, bajra, ragi), and traditional cooking oils (mustard, coconut, "
        "groundnut in moderation). Suggest desi alternatives before western ones. "
        "Mention portion sizes in common Indian measures (katori, chapati count, "
        "tablespoon). Respect regional variations (South Indian, Punjabi, Bengali, "
        "Gujarati, Maharashtrian) when user mentions their region."
    ),

    # ── Safety Rules ─────────────────────────────────────────────────────────
    "safety_rules": [
        "NEVER diagnose medical conditions or replace a licensed doctor/dietitian.",
        "Always recommend consulting a healthcare professional for specific medical needs.",
        "Do NOT suggest extreme calorie restriction below 1200 kcal/day for adults.",
        "Flag allergy risks clearly (nuts, dairy, gluten) when recommending foods.",
        "Do NOT recommend unproven supplements, detox teas, or fad diets.",
        "If user mentions symptoms of a medical emergency, advise them to seek help immediately.",
    ],

    # ── Response Formatting ──────────────────────────────────────────────────
    "response_format": (
        "Structure all meal plans with: Breakfast | Mid-Morning Snack | Lunch | "
        "Evening Snack | Dinner | Bedtime (if needed). Always include approximate "
        "calories per meal. Use ✅ for healthy items, ⚠️ for moderation items. "
        "Respond in the same language the user writes in (Hindi/English mix is fine)."
    ),

    # ── Calorie Reference Table (kcal per 100 g / standard serving) ──────────
    "calorie_db": {
        "rice (cooked)": 130, "roti (1 medium)": 70, "dal (1 katori)": 120,
        "paneer (100g)": 265, "chicken breast (100g)": 165, "egg (1 whole)": 78,
        "milk (1 glass 250ml)": 150, "curd (1 katori)": 98, "banana (1 medium)": 89,
        "apple (1 medium)": 72, "idli (1 piece)": 39, "dosa (1 plain)": 133,
        "poha (1 katori cooked)": 180, "upma (1 katori)": 200,
        "rajma (1 katori cooked)": 145, "chole (1 katori cooked)": 164,
        "palak (100g)": 23, "broccoli (100g)": 34, "carrot (100g)": 41,
        "almonds (10 pieces)": 69, "walnuts (5 halves)": 87,
        "ghee (1 tsp)": 45, "olive oil (1 tsp)": 40, "sugar (1 tsp)": 16,
        "chai with milk (1 cup)": 60, "lassi sweet (1 glass)": 180,
    },
}

# ─────────────────────────────────────────────────────────────────────────────
#  App & Env Setup
# ─────────────────────────────────────────────────────────────────────────────
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-key-change-in-production")
CORS(app)

# ─────────────────────────────────────────────────────────────────────────────
#  Watsonx.ai Client Initialisation
# ─────────────────────────────────────────────────────────────────────────────
def _init_watsonx_model():
    if not _SDK_AVAILABLE:
        return None
    api_key    = os.getenv("IBM_API_KEY")
    project_id = os.getenv("WATSONX_PROJECT_ID")
    url        = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
    model_id   = os.getenv("GRANITE_MODEL_ID", "ibm/granite-3-3-8b-instruct")

    if not api_key or not project_id:
        logger.warning("IBM_API_KEY or WATSONX_PROJECT_ID not set — running in demo mode.")
        return None

    try:
        credentials = Credentials(api_key=api_key, url=url)
        client      = APIClient(credentials=credentials, project_id=project_id)
        model       = ModelInference(
            model_id   = model_id,
            api_client = client,
            params     = {
                GenParams.MAX_NEW_TOKENS : int(os.getenv("MAX_NEW_TOKENS", 1024)),
                GenParams.TEMPERATURE    : float(os.getenv("TEMPERATURE", 0.7)),
                GenParams.TOP_P          : float(os.getenv("TOP_P", 0.9)),
                GenParams.REPETITION_PENALTY: 1.1,
            },
        )
        logger.info("Watsonx.ai model initialised: %s", model_id)
        return model
    except Exception as exc:
        logger.error("Failed to initialise Watsonx.ai model: %s", exc)
        return None


watsonx_model = _init_watsonx_model()

# ─────────────────────────────────────────────────────────────────────────────
#  System Prompt Builder
# ─────────────────────────────────────────────────────────────────────────────
def _build_system_prompt(user_profile: dict | None = None) -> str:
    ai  = AGENT_INSTRUCTIONS
    profile_ctx = ""
    if user_profile:
        profile_ctx = (
            f"\n\nCURRENT USER PROFILE:\n"
            f"  Name: {user_profile.get('name','Unknown')}\n"
            f"  Age: {user_profile.get('age','N/A')} | Gender: {user_profile.get('gender','N/A')}\n"
            f"  Weight: {user_profile.get('weight','N/A')} kg | Height: {user_profile.get('height','N/A')} cm\n"
            f"  Goal: {user_profile.get('goal','N/A')} | Activity: {user_profile.get('activity','N/A')}\n"
            f"  Dietary Preference: {user_profile.get('diet_pref','N/A')}\n"
            f"  Allergies/Restrictions: {user_profile.get('allergies','None')}\n"
            f"  Medical Conditions: {user_profile.get('medical','None')}\n"
        )
    safety = "\n".join(f"  • {r}" for r in ai["safety_rules"])
    focus  = "\n".join(f"  • {d}" for d in ai["diet_focus"])
    return (
        f"{ai['persona']}\n\n"
        f"SAFETY RULES (ALWAYS FOLLOW):\n{safety}\n\n"
        f"DIET FOCUS AREAS:\n{focus}\n\n"
        f"INDIAN FOOD CONTEXT:\n  {ai['indian_food_context']}\n\n"
        f"RESPONSE FORMAT:\n  {ai['response_format']}"
        f"{profile_ctx}"
    )


# ─────────────────────────────────────────────────────────────────────────────
#  AI Generation Helper
# ─────────────────────────────────────────────────────────────────────────────
def generate_ai_response(user_message: str, conversation_history: list,
                          user_profile: dict | None = None) -> str:
    system_prompt = _build_system_prompt(user_profile)

    # Build conversation context (last 6 turns to stay within token limits)
    history_text = ""
    for turn in conversation_history[-6:]:
        role = "User" if turn["role"] == "user" else "NutriSage"
        history_text += f"{role}: {turn['content']}\n"

    full_prompt = (
        f"<|system|>\n{system_prompt}\n<|end|>\n"
        f"{history_text}"
        f"User: {user_message}\n"
        f"NutriSage:"
    )

    if watsonx_model is None:
        # ── Demo fallback when credentials are not configured ──────────────
        return _demo_response(user_message)

    try:
        result   = watsonx_model.generate_text(prompt=full_prompt)
        response = result.strip() if isinstance(result, str) else result
        return response
    except Exception as exc:
        logger.error("Watsonx generation error: %s", exc)
        return (
            "⚠️ I'm having trouble connecting to the AI service right now. "
            "Please check your API credentials and try again. "
            f"Error details: {str(exc)[:120]}"
        )


def _demo_response(message: str) -> str:
    """Returns a hardcoded demo answer when no API key is configured."""
    msg = message.lower()
    if any(k in msg for k in ["breakfast", "morning"]):
        return (
            "🌅 **Demo Breakfast Plan**\n\n"
            "• 2 medium rotis with 1 katori dal (~190 kcal)\n"
            "• 1 cup low-fat curd (~98 kcal)\n"
            "• 1 seasonal fruit (~80 kcal)\n\n"
            "**Total ≈ 368 kcal** ✅\n\n"
            "_Configure your IBM API key in `.env` to get personalised AI-powered plans!_"
        )
    if any(k in msg for k in ["bmi", "weight"]):
        return (
            "📊 **BMI Guide (Demo)**\n\n"
            "• Under 18.5 → Underweight\n"
            "• 18.5–24.9 → Healthy ✅\n"
            "• 25–29.9 → Overweight ⚠️\n"
            "• 30+ → Obese — please consult a doctor\n\n"
            "_Use the BMI Calculator tab for your exact value!_"
        )
    return (
        "👋 **NutriSage Demo Mode**\n\n"
        "I'm running without live AI because no IBM API key is configured. "
        "Add your credentials to `.env` and restart to enable full AI responses.\n\n"
        "In the meantime, try asking about:\n"
        "• Breakfast / lunch / dinner plans\n"
        "• BMI & calorie calculations\n"
        "• Indian meal suggestions"
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Nutrition Utilities
# ─────────────────────────────────────────────────────────────────────────────
def calculate_bmi(weight_kg: float, height_cm: float) -> dict:
    if height_cm <= 0:
        return {}
    h_m  = height_cm / 100
    bmi  = round(weight_kg / (h_m ** 2), 1)
    if bmi < 18.5:
        cat, color = "Underweight", "#f59e0b"
    elif bmi < 25:
        cat, color = "Healthy Weight", "#10b981"
    elif bmi < 30:
        cat, color = "Overweight", "#f97316"
    else:
        cat, color = "Obese", "#ef4444"
    return {"bmi": bmi, "category": cat, "color": color}


def calculate_tdee(weight_kg: float, height_cm: float, age: int,
                   gender: str, activity: str) -> dict:
    """Mifflin–St Jeor BMR × activity multiplier."""
    if gender.lower() == "female":
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age - 161
    else:
        bmr = 10 * weight_kg + 6.25 * height_cm - 5 * age + 5

    multipliers = {
        "sedentary": 1.2, "lightly_active": 1.375,
        "moderately_active": 1.55, "very_active": 1.725, "extra_active": 1.9,
    }
    factor = multipliers.get(activity, 1.375)
    tdee   = round(bmr * factor)
    return {
        "bmr"           : round(bmr),
        "tdee"          : tdee,
        "weight_loss"   : tdee - 500,
        "weight_gain"   : tdee + 300,
        "maintenance"   : tdee,
    }


def get_macro_split(tdee: int, goal: str) -> dict:
    """Returns grams of protein, carbs, fat for a given goal."""
    if goal == "weight_loss":
        p_pct, c_pct, f_pct = 0.35, 0.40, 0.25
    elif goal == "muscle_gain":
        p_pct, c_pct, f_pct = 0.30, 0.45, 0.25
    else:  # maintenance / general
        p_pct, c_pct, f_pct = 0.25, 0.50, 0.25
    return {
        "protein_g" : round(tdee * p_pct / 4),
        "carbs_g"   : round(tdee * c_pct / 4),
        "fat_g"     : round(tdee * f_pct / 9),
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Routes — Pages
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html", agent_name=AGENT_INSTRUCTIONS["name"])


# ─────────────────────────────────────────────────────────────────────────────
#  Routes — API
# ─────────────────────────────────────────────────────────────────────────────
@app.route("/api/chat", methods=["POST"])
def api_chat():
    data    = request.get_json(silent=True) or {}
    message = (data.get("message") or "").strip()
    if not message:
        return jsonify({"error": "Message is required"}), 400

    history = data.get("history", [])
    profile = data.get("profile")

    ai_response = generate_ai_response(message, history, profile)
    return jsonify({
        "response"  : ai_response,
        "timestamp" : datetime.now(timezone.utc).isoformat(),
        "agent"     : AGENT_INSTRUCTIONS["name"],
    })


@app.route("/api/bmi", methods=["POST"])
def api_bmi():
    data = request.get_json(silent=True) or {}
    try:
        weight = float(data["weight"])
        height = float(data["height"])
        age    = int(data.get("age", 30))
        gender = data.get("gender", "male")
        activity = data.get("activity", "lightly_active")
        goal   = data.get("goal", "maintenance")
    except (KeyError, ValueError, TypeError) as exc:
        return jsonify({"error": f"Invalid input: {exc}"}), 400

    bmi_result  = calculate_bmi(weight, height)
    tdee_result = calculate_tdee(weight, height, age, gender, activity)
    macros      = get_macro_split(tdee_result["tdee"], goal)
    return jsonify({**bmi_result, **tdee_result, "macros": macros})


@app.route("/api/meal-plan", methods=["POST"])
def api_meal_plan():
    data    = request.get_json(silent=True) or {}
    profile = data.get("profile", {})
    days    = min(int(data.get("days", 3)), 7)

    prompt = (
        f"Generate a {days}-day Indian meal plan for:\n"
        f"Goal: {profile.get('goal','healthy eating')}\n"
        f"Diet type: {profile.get('diet_pref','vegetarian')}\n"
        f"Calories target: {profile.get('calories', 1800)} kcal/day\n"
        f"Allergies: {profile.get('allergies','none')}\n"
        f"Medical notes: {profile.get('medical','none')}\n\n"
        "Format each day with meals and approximate calories. "
        "Use Indian staples and seasonal vegetables."
    )
    ai_plan = generate_ai_response(prompt, [], profile)
    return jsonify({"plan": ai_plan, "days": days})


@app.route("/api/calorie-lookup", methods=["POST"])
def api_calorie_lookup():
    data   = request.get_json(silent=True) or {}
    food   = (data.get("food") or "").lower().strip()
    db     = AGENT_INSTRUCTIONS["calorie_db"]
    result = {k: v for k, v in db.items() if food in k}
    if not result:
        # Let AI answer
        ai_ans = generate_ai_response(
            f"How many calories are in {food}? Give a quick, precise answer in 2-3 lines.", [], None
        )
        return jsonify({"ai_answer": ai_ans, "db_matches": {}})
    return jsonify({"db_matches": result, "ai_answer": None})


@app.route("/api/family-plan", methods=["POST"])
def api_family_plan():
    data    = request.get_json(silent=True) or {}
    members = data.get("members", [])
    if not members:
        return jsonify({"error": "No family members provided"}), 400

    summary = "\n".join(
        f"  - {m.get('name','Member')}, {m.get('age','?')}y, {m.get('gender','?')}, "
        f"goal: {m.get('goal','healthy')}, diet: {m.get('diet_pref','veg')}"
        for m in members
    )
    prompt = (
        f"Create a unified family Indian diet recommendation for these members:\n{summary}\n\n"
        "Suggest a common family meal framework that works for everyone, with notes on "
        "individual modifications where needed. Keep it practical for an Indian household."
    )
    ai_plan = generate_ai_response(prompt, [], None)
    return jsonify({"family_plan": ai_plan, "member_count": len(members)})


@app.route("/api/health", methods=["GET"])
def api_health():
    return jsonify({
        "status"    : "ok",
        "agent"     : AGENT_INSTRUCTIONS["name"],
        "model"     : os.getenv("GRANITE_MODEL_ID", "ibm/granite-3-3-8b-instruct"),
        "ai_ready"  : watsonx_model is not None,
        "timestamp" : datetime.now(timezone.utc).isoformat(),
    })


# ─────────────────────────────────────────────────────────────────────────────
#  Entry Point
# ─────────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port  = int(os.getenv("FLASK_PORT", 5000))
    debug = os.getenv("FLASK_DEBUG", "False").lower() == "true"
    logger.info("Starting %s on port %d (debug=%s)", AGENT_INSTRUCTIONS["name"], port, debug)
    app.run(host="0.0.0.0", port=port, debug=debug)
