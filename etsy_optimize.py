import requests, json, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

env_path = r'C:\Users\02zah.BPDLH\OneDrive\Dokumen\Default Project\jaun-manager\.env'
token_json = None
api_key = None
api_secret = None
with open(env_path) as f:
    for line in f:
        if line.startswith('ETSY_TOKEN_JSON'):
            token_json = json.loads(line.split('=', 1)[1].strip())
        if line.startswith('ETSY_KEYSTRING'):
            api_key = line.split('=', 1)[1].strip()
        if line.startswith('ETSY_SECRET'):
            api_secret = line.split('=', 1)[1].strip()

# Refresh token
r = requests.post('https://api.etsy.com/v3/public/oauth/token', data={
    'grant_type': 'refresh_token',
    'client_id': api_key,
    'refresh_token': token_json['refresh_token']
})
data = r.json()
new_token = data['access_token']
new_refresh = data['refresh_token']
if '.' in new_token:
    formatted_token = new_token
else:
    user_id = new_refresh.split('.')[0]
    formatted_token = f'{user_id}.{new_token}'

# Save new token
import time
token_json['access_token'] = new_token
token_json['refresh_token'] = new_refresh
token_json['expires_at'] = time.time() + 3600
with open(env_path, 'r') as f:
    content = f.read()
old_json = json.dumps({"access_token": new_token, "refresh_token": new_refresh, "expires_at": token_json['expires_at']})
lines = content.split('\n')
for i, line in enumerate(lines):
    if line.startswith('ETSY_TOKEN_JSON'):
        lines[i] = f'ETSY_TOKEN_JSON={old_json}'
        break
with open(env_path, 'w') as f:
    f.write('\n'.join(lines))

headers = {
    'x-api-key': f'{api_key}:{api_secret}',
    'Authorization': f'Bearer {formatted_token}',
    'Content-Type': 'application/json'
}
shop_id = 67512564
base = 'https://openapi.etsy.com/v3'

# ========== OPTIMIZED LISTINGS ==========
updates = [
    {
        "listing_id": 4555561749,
        "tags": [
            "ai prompt indonesia",
            "chatgpt prompt id",
            "copywriting prompt",
            "marketing prompts",
            "business prompt ai",
            "prompt template",
            "indonesian prompts",
            "ai writing tool",
            "social media prompt",
            "instagram caption",
            "email marketing",
            "sales copy template",
            "content creation"
        ],
        "title": "108 AI Prompt Bahasa Indonesia | ChatGPT Copywriting Templates | Marketing Prompts | AI Toolkit",
        "description": """108 AI PROMPT BAHASA INDONESIA - COPYWRITING & MARKETING TEMPLATES

Instantly boost your content creation with 108 ready-to-use AI prompts in Bahasa Indonesia! Perfect for entrepreneurs, marketers, content creators, and small business owners who want to leverage ChatGPT and AI tools for their business.

WHAT YOU GET:
- 108 carefully crafted prompts in Bahasa Indonesia
- Covering: social media, email marketing, sales copy, blog posts, product descriptions, and more
- Copy-paste ready - just add your product/brand details
- Works with ChatGPT, Claude, Gemini, and any AI tool
- Instant download (PDF format)

CATEGORIES INCLUDED:
1. Social Media Prompts (Instagram, TikTok, Facebook)
2. Email Marketing Prompts
3. Sales Page & Landing Page Copy
4. Product Description Prompts
5. Blog Post & Article Prompts
6. Customer Service Response Templates
7. Brand Story & About Us Prompts
8. Advertising Copy Templates

HOW IT WORKS:
1. Download the PDF after purchase
2. Copy any prompt you need
3. Paste into ChatGPT or your preferred AI tool
4. Get professional copywriting in seconds!

Perfect for:
- UMKM & Small Business Owners
- Freelance Marketers
- Content Creators
- Social Media Managers
- Online Shop Owners
- Digital Nomads

No more staring at blank screens! These prompts will help you create engaging content that converts.

Instant Download | No Physical Product | PDF Format
IDR 149.000 (approx. $9.50 USD)"""
    },
    {
        "listing_id": 4555673104,
        "tags": [
            "budget spreadsheet",
            "paycheck planner",
            "google sheets budget",
            "finance tracker id",
            "monthly budget sheet",
            "expense planner",
            "money management",
            "budget template 2026",
            "salary planner",
            "savings tracker",
            "bill tracker",
            "financial planner",
            "auto calculate budget"
        ],
        "title": "Semi-Monthly Budget Spreadsheet Google Sheets | Paycheck Planner | Auto Calculator | Finance Tracker 2026",
        "description": """SEMI-MONTHLY BUDGET SPREADSHEET - GOOGLE SHEETS TEMPLATE

Take control of your finances with this automated semi-monthly budget planner! Designed for Indonesian salaried workers who get paid twice a month (1st & 15th).

FEATURES:
- Semi-monthly budget layout (Perfect for Gaji 1 & Gaji 2)
- Auto-calculating formulas (no manual math!)
- Expense categories customized for Indonesian lifestyle
- Savings tracker with progress bar
- Debt payoff calculator
- Visual charts & graphs
- Mobile-friendly (works on phone browser)

WHAT'S INCLUDED:
- 1 Google Sheets template
- Pre-built expense categories (Makanan, Transport, Tagihan, etc.)
- Income tracker
- Savings goal tracker
- Monthly summary dashboard
- 12-month overview

CUSTOM CATEGORIES:
- Makanan & Minuman
- Transport & BBM
- Tagihan (Listrik, Air, Internet, etc.)
- Belanja Bulanan
- Cicilan & Hutang
- Tabungan & Investasi
- Hiburan & Lifestyle
- Kesehatan
- Pendidikan

HOW TO USE:
1. Purchase & download the instruction PDF
2. Make a copy of the Google Sheets template
3. Enter your income & expenses
4. Watch the dashboard update automatically!

No Excel skills needed. Works on any device with a browser.

Instant Download | Google Sheets | No Physical Product
IDR 149.000 (approx. $9.50 USD)"""
    },
    {
        "listing_id": 4555649945,
        "tags": [
            "umkm instagram",
            "canva feed template",
            "instagram post design",
            "small business kit",
            "social media bundle",
            "instagram template id",
            "content creator kit",
            "marketing template",
            "business instagram",
            "post template canva",
            "brand kit umkm",
            "jual online template",
            "promosi instagram"
        ],
        "title": "UMKM Instagram Feed Template 100+ Canva Designs | Social Media Kit | Small Business Marketing Bundle",
        "description": """100+ INSTAGRAM FEED TEMPLATES FOR UMKM & SMALL BUSINESS

Level up your Instagram game with 100+ professionally designed templates made specifically for Indonesian small businesses (UMKM)!

PERFECT FOR:
- Online shop (toko online)
- Food & beverage businesses
- Fashion & clothing stores
- Beauty & skincare brands
- Service-based businesses
- Freelancers & solopreneurs

WHAT YOU GET:
- 100+ Instagram post templates (feed & carousel)
- 50+ Instagram story templates
- 20+ Reels cover templates
- All editable in Canva (free account works!)
- Indonesian text placeholders
- Professional color schemes

TEMPLATE CATEGORIES:
1. Product Showcase Posts
2. Testimonial & Review Posts
3. Promotion & Sale Announcements
4. Tips & Educational Content
5. Behind-the-Scenes Posts
6. Quote & Motivation Posts
7. Seasonal & Holiday Templates (Hari Raya, Idul Fitri, etc.)
8. Menu & Price List Templates
9. Before & After Posts
10. FAQ & How-To Posts

BONUS:
- Content calendar planner
- Hashtag cheat sheet for Indonesian market
- Color palette guide
- Font pairing recommendations

CANVA FEATURES:
- 100% editable in Canva (free or Pro)
- Drag & drop customization
- Change photos, colors, text easily
- Export as PNG, JPG, or PDF
- Mobile-optimized dimensions

No design skills needed! Just open Canva, replace the placeholder content with your own, and post.

Instant Download | Canva Templates | No Physical Product
IDR 119.000 (approx. $7.60 USD)"""
    },
    {
        "listing_id": 4558637095,
        "tags": [
            "instagram story",
            "canva story template",
            "social media kit",
            "story design bundle",
            "content creator kit",
            "reels cover template",
            "ig story pack",
            "brand story kit",
            "marketing template",
            "story highlight",
            "instagram design",
            "story template 2026",
            "social template"
        ],
        "title": "Instagram Story Templates Bundle 50+ Canva Designs | Social Media Kit | Reels Cover | Story Highlights",
        "description": """50+ INSTAGRAM STORY TEMPLATES - CANVA EDITABLE

Make your Instagram stories stand out with 50+ stunning templates! Perfect for content creators, influencers, and businesses who want a cohesive, professional look.

WHAT'S INCLUDED:
- 50+ Story templates (9:16 ratio)
- 20+ Reels cover templates
- 10+ Story Highlight covers
- 15+ Poll & Quiz interactive templates
- All editable in Canva (free account!)

TEMPLATE STYLES:
1. Minimalist & Clean
2. Bold & Colorful
3. Aesthetic & Soft
4. Professional & Corporate
5. Fun & Playful
6. Dark Mode Templates
7. Gradient & Abstract
8. Photo-centric Designs

PERFECT FOR:
- Daily stories
- Product announcements
- Polls & questions
- Behind-the-scenes
- Testimonials
- Sale promotions
- Event announcements
- Personal branding

CANVA FEATURES:
- 100% customizable
- Change colors, fonts, images
- Add your own photos
- Export as PNG or share directly
- Works on mobile & desktop

BONUS:
- Story posting schedule guide
- Engagement tips for Indonesian market
- Best time to post cheat sheet
- Hashtag strategy guide

Instant Download | Canva Templates | No Physical Product
IDR 149.000 (approx. $9.50 USD)"""
    },
    {
        "listing_id": 4556156773,
        "tags": [
            "expense tracker google",
            "tax estimator sheet",
            "personal finance id",
            "budget planner sheet",
            "money tracker auto",
            "finance spreadsheet",
            "expense report",
            "tax calculator id",
            "savings tracker",
            "auto calculate sheet",
            "financial planner",
            "budget tool 2026",
            "income expense"
        ],
        "title": "Automated Expense Tracker Google Sheets | Tax Estimator | Personal Finance Budget | Auto Calculator",
        "description": """AUTOMATED EXPENSE TRACKER & TAX ESTIMATOR - GOOGLE SHEETS

Track every Rupiah automatically! This all-in-one personal finance spreadsheet does the math for you. Perfect for freelancers, UMKM owners, and anyone who wants to manage their money better.

KEY FEATURES:
- Auto-calculating formulas (no manual entry!)
- Built-in tax estimation for Indonesian freelancers
- Monthly, quarterly, & yearly summaries
- Category-based expense tracking
- Income vs Expense dashboard
- Savings progress tracker
- Debt payoff calculator

EXPENSE CATEGORIES:
- Makanan & Minuman
- Transport & BBM
- Listrik, Air, Internet
- Belanja & Shopping
- Kesehatan
- Pendidikan
- Hiburan
- Tabungan & Investasi
- Cicilan & Hutang
- Donasi & Zakat
- Custom categories

TAX FEATURES:
- PPh 21 estimation
- Freelancer tax calculator
- Invoice tracker for tax purposes
- Monthly tax provision calculator
- Tax deadline reminders

DASHBOARD INCLUDES:
- Monthly spending overview
- Category breakdown (pie chart)
- Income vs Expense comparison
- Savings goal progress
- Year-over-year comparison
- Top spending categories

HOW TO USE:
1. Purchase & receive Google Sheets link
2. Make a copy to your Google Drive
3. Start entering your transactions
4. Dashboard updates automatically!

Works on: Desktop, Tablet, Mobile (any browser)
No Excel skills needed!

Instant Download | Google Sheets | No Physical Product
IDR 134.000 (approx. $8.50 USD)"""
    }
]

# Apply updates
for update in updates:
    listing_id = update['listing_id']
    payload = {
        'title': update['title'],
        'tags': update['tags'],
        'description': update['description']
    }
    
    r = requests.patch(
        f'{base}/application/shops/{shop_id}/listings/{listing_id}',
        headers=headers,
        json=payload
    )
    
    if r.status_code == 200:
        print(f'OK: {update["title"][:60]}')
    else:
        print(f'FAIL {listing_id}: {r.status_code} {r.text[:200]}')

print('\nDone!')
