# 🥗 NutriSage — AI-Powered Nutrition Agent

> **IBM Watsonx.ai + Granite · Flask · Bootstrap 5**

A full-stack AI nutrition web application that gives personalised Indian meal plans, BMI analysis, family diet recommendations, and real-time calorie lookups — powered by IBM Granite models on Watsonx.ai.

---

## ✨ Features

| Feature | Details |
|---|---|
| 💬 **AI Chat** | Real-time nutrition Q&A via IBM Granite |
| 📊 **Dashboard** | BMI, TDEE, BMR, macros, calorie targets |
| 🧮 **BMI & TDEE Calculator** | Mifflin–St Jeor with animated gauge |
| 📅 **AI Meal Planner** | 1–7 day personalised Indian meal plans |
| 👨‍👩‍👧 **Family Profiles** | Multi-member unified diet recommendations |
| 🔍 **Calorie Lookup** | 25+ Indian foods + AI fallback |
| 🌙 **Dark Mode** | Persistent across sessions |
| 📱 **Mobile Responsive** | Full Bootstrap 5 + offcanvas sidebar |

---

## 🚀 Quick Start

### 1. Clone / Download the project

```bash
cd NutriSage
```

### 2. Create a virtual environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure credentials

```bash
cp .env.example .env
```

Edit `.env` and fill in your IBM Cloud credentials:

```env
IBM_API_KEY=your_ibm_cloud_api_key_here
WATSONX_PROJECT_ID=your_watsonx_project_id_here
WATSONX_URL=https://us-south.ml.cloud.ibm.com
FLASK_SECRET_KEY=some-long-random-string
```

> **Get IBM credentials:**
> 1. Go to [cloud.ibm.com](https://cloud.ibm.com) → Create a free account
> 2. Create a **Watsonx.ai** service instance
> 3. Copy your **API Key** from IAM → Service Credentials
> 4. Copy your **Project ID** from the Watsonx.ai project settings

### 5. Run the app

```bash
python app.py
```

Open **http://localhost:5000** in your browser.

---

## 🔧 Customise the Agent

The entire agent behaviour is controlled by a single `AGENT_INSTRUCTIONS` dict at the top of [`app.py`](app.py). You can change:

```python
AGENT_INSTRUCTIONS = {
    "name"          : "NutriSage",       # Change the agent name
    "persona"       : "...",             # Tone, style, personality
    "diet_focus"    : [...],             # Areas of specialisation
    "indian_food_context": "...",        # Indian food priorities
    "safety_rules"  : [...],             # Hard safety constraints
    "response_format": "...",            # Output structure rules
    "calorie_db"    : {...},             # Local calorie lookup table
}
```

No other code changes needed — restart Flask to apply.

---

## 📁 Project Structure

```
NutriSage/
├── app.py                  ← Flask app + Watsonx.ai + all API routes
├── requirements.txt        ← Python dependencies
├── .env.example            ← Environment variable template
├── .env                    ← Your secrets (never commit!)
├── templates/
│   └── index.html          ← Single-page app shell
└── static/
    ├── css/
    │   └── style.css       ← Custom styles + dark mode
    └── js/
        └── app.js          ← All frontend logic
```

---

## 🌐 API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET`  | `/`                  | Serve the web app |
| `POST` | `/api/chat`          | AI chat response |
| `POST` | `/api/bmi`           | BMI + TDEE calculation |
| `POST` | `/api/meal-plan`     | Generate AI meal plan |
| `POST` | `/api/calorie-lookup`| Look up food calories |
| `POST` | `/api/family-plan`   | Family diet recommendation |
| `GET`  | `/api/health`        | Service health check |

---

## ☁️ Production Deployment

### Option A — Gunicorn (Linux / macOS)

```bash
gunicorn -w 2 -b 0.0.0.0:5000 app:app
```

### Option B — IBM Code Engine / Cloud Foundry

1. Create a `Procfile`:
   ```
   web: gunicorn -w 2 -b 0.0.0.0:$PORT app:app
   ```
2. Set env vars via the IBM Cloud console (never commit `.env`)
3. Deploy with IBM Cloud CLI:
   ```bash
   ibmcloud cf push nutrisage
   ```

### Option C — Docker

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn","-w","2","-b","0.0.0.0:5000","app:app"]
```

```bash
docker build -t nutrisage .
docker run -p 5000:5000 --env-file .env nutrisage
```

---

## ⚙️ Model Configuration

Change the Granite model in `.env`:

```env
GRANITE_MODEL_ID=ibm/granite-3-3-8b-instruct   # default (fast)
# GRANITE_MODEL_ID=ibm/granite-13b-instruct-v2  # larger, more detailed
MAX_NEW_TOKENS=1024
TEMPERATURE=0.7
TOP_P=0.9
```

---

## 🔒 Security Notes

- Never commit `.env` — it's in `.gitignore` by default
- Use a strong random `FLASK_SECRET_KEY` in production
- Set `FLASK_DEBUG=False` in production
- Consider rate-limiting the `/api/chat` endpoint for public deployments

---

## 📦 Tech Stack

| Layer | Technology |
|---|---|
| AI Model | IBM Granite 3.3 8B Instruct |
| AI Platform | IBM Watsonx.ai |
| Backend | Python 3.12 · Flask 3 |
| Frontend | Bootstrap 5.3 · Chart.js 4 |
| Icons | Bootstrap Icons 1.11 |
| Font | Inter · Poppins (Google Fonts) |
| Deployment | Gunicorn · IBM Cloud |

---

## 🤝 Contributing

Contributions are welcome! To add a new diet specialisation, simply append to `AGENT_INSTRUCTIONS["diet_focus"]` in `app.py`. To add more foods to the calorie DB, extend `AGENT_INSTRUCTIONS["calorie_db"]`.

---

*Made with ❤️ using IBM Watsonx.ai*
