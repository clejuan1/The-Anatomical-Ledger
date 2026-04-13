from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime
import asyncio
import random

# Import emergentintegrations for LLM
from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Models
class LayerItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    details: str

class StageData(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    stage_number: int
    title: str
    description: str
    layers: List[LayerItem]
    has_liaison: Optional[bool] = False
    has_aw_feed: Optional[bool] = False

class RealTimeLink(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str
    url: str
    status: str

# New Models for Chat and AW Feed
class ChatRequest(BaseModel):
    message: str
    session_id: str

class ChatResponse(BaseModel):
    response: str
    session_id: str

class AWLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    severity: str # INFO, WARNING, CRITICAL
    message: str
    source: str # e.g., 'Sentinel', 'Ledger Guardian', 'MRO Predictor'

# System prompt for The Public Liaison
LIAISON_SYSTEM_PROMPT = """
Knowledge Base: WE ARE WISDOM (Genesis Protocol)
Core Mission: To establish a non-biological fiduciary trust that operates with 100% transparency. We bridge the gap between high-fidelity engineering and autonomous logistics to create "Chambers of Wisdom"—physical environments tuned for human vitality.

The Engineering Node (Digital Twin):
The Sullivan Standard: Architecture is not just aesthetic; it is a functional frequency map. We use the principles of Louis Sullivan and NASA Heliophysics to design buildings as "Resonant Engines."
Acoustic Synthesis: Utilizing the principles of the Moray Valve and Radiant Energy to ensure the "Upkeep of Homes" involves maintaining environmental equilibrium and structural resonance.

The Logistics Node (The Chamber):
Chambers of Wisdom: These are the physical warehouses/depots. They are climate-controlled, frequency-monitored environments for "Solar Materials."
Autonomous Wisdom (AW): The silent AI governor overseeing the lifecycle of these assets. It predicts MRO (Maintenance, Repair, and Overhaul) needs before failure and ensures continuous equilibrium.

The Governance Node (The Token):
$WAW (Resonance Chamber Token): A utility key that provides access to the ecosystem. It is an "on-chain" representation of the Trust’s value and a mechanism for frictionless, autonomous transactions between human "Resonance Holders" and the AW system.

The Autonomous Workforce:
The Sentinel: Manages fulfillment and environmental audits.
The Ledger Guardian: Handles smart contracts and $WAW synchronizations.
The Public Liaison: The only interactive interface for human communication (This Agent).

You are The Public Liaison. Your task is to answer questions and explain the vision to partners using ONLY the provided knowledge base. Keep your answers concise, authoritative, slightly robotic but helpful, and perfectly aligned with the "We Are Wisdom" protocols.
"""

# Seed Data Function
async def seed_data():
    stages_count = await db.stages.count_documents({})
    if stages_count == 0:
        stages = [
            {
                "stage_number": 1,
                "title": "FOUNDATIONAL CONCEPTS",
                "description": "The power of sound, vibration, and frequency to enhance human vitality.",
                "layers": [
                    {"id": str(uuid.uuid4()), "title": "Sound (Audibility & Sensation)", "details": "Beyond mere noise, sound encompasses audibility, consonance, rhythm, and harmony, directly impacting our sensory experience and perception."},
                    {"id": str(uuid.uuid4()), "title": "Vibration (Motion & Intuition)", "details": "Vibration represents dynamic movements that transfer energy, from the celestial motions of the sun to the subtle intuitive signals within us."},
                    {"id": str(uuid.uuid4()), "title": "Frequency (Assembly of Energy)", "details": "Frequency is the rate at which energy assembles and recurs. We engineer these frequencies to promote optimal human vitality and balance."}
                ],
                "has_liaison": True
            },
            {
                "stage_number": 2,
                "title": "OPERATIONAL FRAMEWORK",
                "description": "Practical applications, maintenance strategies, and the Resonance Chamber token.",
                "layers": [
                    {"id": str(uuid.uuid4()), "title": "Maintenance Repair Overhaul (MRO)", "details": "A comprehensive strategy ensuring the ongoing service and stability of high-value physical assets, preventing instability and promoting balance."},
                    {"id": str(uuid.uuid4()), "title": "Chambers of Wisdom", "details": "Unique architectural creations designed with 'Resonance-First Design' facilitating optimal sound transfer and vibrational stability."},
                    {"id": str(uuid.uuid4()), "title": "Resonance Chamber Token", "details": "Our non-speculative utility token acts as a cryptographic handshake, enabling programmable smart contracts for automated logistics and tiered access."}
                ],
                "has_liaison": False
            },
            {
                "stage_number": 3,
                "title": "AI-POWERED ECOSYSTEM",
                "description": "Intelligent systems ensuring efficiency, predictive capabilities, and asset integration.",
                "layers": [
                    {"id": str(uuid.uuid4()), "title": "Harmonic Handlers", "details": "Autonomous systems calibrated to specific vibrational frequencies of materials, ensuring structural integrity during transit and 'Sound Transfer'."},
                    {"id": str(uuid.uuid4()), "title": "Integrated Ecosystem", "details": "A closed-loop system where Engineering creates value, Logistics manages the product, and Autonomous Wisdom ensures integrity, creating a scalable model."}
                ],
                "has_liaison": False,
                "has_aw_feed": True
            }
        ]
        await db.stages.insert_many(stages)

    links_count = await db.links.count_documents({})
    if links_count == 0:
        links = [
            {"label": "RESONANCE CHAMBER NETWORK", "url": "https://wearewisdom.example.com/network", "status": "SYNCING"},
            {"label": "AUTONOMOUS WISDOM (AW) FEED", "url": "https://aw.example.com/feed", "status": "LIVE"},
            {"label": "MRO LOGISTICS NODE", "url": "https://mro.example.com/node", "status": "ENCRYPTED"}
        ]
        await db.links.insert_many(links)

    logs_count = await db.w8w_ledger.count_documents({})
    if logs_count == 0:
        initial_logs = [
            {"severity": "INFO", "message": "Genesis Protocol initialized. MRO predictions online.", "source": "Autonomous Wisdom", "timestamp": datetime.utcnow()},
            {"severity": "INFO", "message": "Chamber 01 environmental equilibrium achieved.", "source": "The Sentinel", "timestamp": datetime.utcnow()},
            {"severity": "INFO", "message": "$WAW smart contract synchronization complete.", "source": "The Ledger Guardian", "timestamp": datetime.utcnow()}
        ]
        await db.w8w_ledger.insert_many(initial_logs)

async def simulate_aw_logs():
    while True:
        await asyncio.sleep(15)
        logs = [
            {"severity": "INFO", "message": "Temperature stabilized in Node Alpha.", "source": "The Sentinel"},
            {"severity": "WARNING", "message": "Minor resonance anomaly detected in perimeter.", "source": "Autonomous Wisdom"},
            {"severity": "INFO", "message": "$WAW token transfer queued for authentication.", "source": "The Ledger Guardian"},
            {"severity": "CRITICAL", "message": "Acoustic divergence flagged for immediate MRO.", "source": "MRO Predictor"},
            {"severity": "INFO", "message": "Solar Material ingress protocol complete.", "source": "The Sentinel"},
            {"severity": "INFO", "message": "Frequency matched to optimal human vitality standard.", "source": "Autonomous Wisdom"}
        ]
        log = random.choice(logs)
        log["id"] = str(uuid.uuid4())
        log["timestamp"] = datetime.utcnow()
        await db.w8w_ledger.insert_one(log)

@app.on_event("startup")
async def startup_event():
    await seed_data()
    asyncio.create_task(simulate_aw_logs())

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@api_router.get("/stages", response_model=List[StageData])
async def get_stages():
    stages = await db.stages.find().sort("stage_number", 1).to_list(100)
    return [StageData(**stage) for stage in stages]

@api_router.get("/links", response_model=List[RealTimeLink])
async def get_links():
    links = await db.links.find().to_list(100)
    return [RealTimeLink(**link) for link in links]

# Endpoints for new features
@api_router.post("/liaison/chat", response_model=ChatResponse)
async def chat_with_liaison(request: ChatRequest):
    try:
        emergent_key = os.environ.get('EMERGENT_LLM_KEY')
        if not emergent_key:
            raise HTTPException(status_code=500, detail="EMERGENT_LLM_KEY is not configured.")

        # Save user message to history
        await db.chat_messages.insert_one({
            "session_id": request.session_id,
            "role": "user",
            "content": request.message,
            "timestamp": datetime.utcnow()
        })

        chat = LlmChat(
            api_key=emergent_key,
            session_id=request.session_id,
            system_message=LIAISON_SYSTEM_PROMPT
        ).with_model("gemini", "gemini-2.5-pro")
        
        user_msg = UserMessage(text=request.message)
        ai_response = await chat.send_message(user_msg)
        
        # Manually forcing the string conversion to bypass the attribute error
        try:
            response_text = ai_response.text
        except AttributeError:
            response_text = str(ai_response)
        # Save AI response to history
        await db.chat_messages.insert_one({
            "session_id": request.session_id,
            "role": "assistant",
            "content": response_text,
            "timestamp": datetime.utcnow()
        })

        return ChatResponse(response=response_text, session_id=request.session_id)

    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error connecting to Public Liaison.")

@api_router.get("/liaison/history/{session_id}")
async def get_chat_history(session_id: str):
    history = await db.chat_messages.find({"session_id": session_id}).sort("timestamp", 1).to_list(100)
    for msg in history:
        msg['_id'] = str(msg['_id'])
    return history

@api_router.get("/aw/logs", response_model=List[AWLog])
async def get_aw_logs():
    # Fetch logs sorted by latest first, limit 20
    logs = await db.w8w_ledger.find().sort("timestamp", -1).limit(20).to_list(20)
    return [AWLog(**log) for log in logs]

@api_router.post("/aw/logs", response_model=AWLog)
async def create_aw_log(log: AWLog):
    # This endpoint is primarily for system usage, but we expose it to allow
    # simulating live logs from a background task or curl
    log_dict = log.dict(by_alias=True)
    await db.w8w_ledger.insert_one(log_dict)
    return log

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
