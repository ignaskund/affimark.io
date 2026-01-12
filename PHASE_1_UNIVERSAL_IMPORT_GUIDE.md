# Phase 1: Universal Import + Dashboard - Complete

## 🎯 What We Built

**Feature**: Multi-storefront connection + unified earnings dashboard with multi-currency support

**Value**: Creators can connect Amazon DE + Amazon UK + Awin + LTK all in one place and see total earnings in EUR (or their home currency).

---

## 📊 How It Works (User Perspective)

### Step 1: Connect First Storefront

**User Action**: User clicks "Connect Storefront" → Selects "Amazon DE"

**What Happens**:
1. User uploads Amazon Associates earnings report CSV
2. System creates `connected_account` record with `platform: 'amazon_de'`
3. CSV Importer parses the file using Amazon-specific format
4. Each row becomes an `affiliate_transaction`:
   - Original currency: EUR
   - Commission: €2.45
   - Product: "Sony WH-1000XM5 Headphones"
   - Date: 2024-01-15
5. Currency Converter checks: Already EUR → No conversion needed
6. Transaction saved with `commission_eur: 2.45`

**Result**: User sees "Amazon DE connected ✓ - 47 transactions imported"

---

### Step 2: Connect Second Storefront (Different Currency)

**User Action**: User clicks "Connect Another" → Selects "Amazon UK"

**What Happens**:
1. User uploads Amazon UK CSV
2. System creates second `connected_account` with `platform: 'amazon_uk'`
3. CSV Importer parses UK format
4. Each transaction in GBP (e.g., £3.20 commission)
5. Currency Converter:
   - Checks `exchange_rates` table for GBP→EUR rate on transaction date
   - Finds: 1 GBP = 1.17 EUR (2024-01-15)
   - Calculates: £3.20 × 1.17 = €3.74
6. Transaction saved with:
   - `commission: 3.20`
   - `original_currency: 'GBP'`
   - `commission_eur: 3.74`
   - `exchange_rate: 1.17`

**Result**: User sees "Amazon UK connected ✓ - 23 transactions imported"

---

### Step 3: View Unified Dashboard

**User Action**: User goes to dashboard

**What User Sees**:

```
┌─────────────────────────────────────────────────────────────────┐
│  Total Earnings (Last 30 Days)                                  │
│  €4,230.45                                     ↑ +12.3%         │
├─────────────────────────────────────────────────────────────────┤
│  Breakdown by Storefront                                        │
│                                                                 │
│  Amazon DE         ████████████████████ €2,100.00   49.6%      │
│  Amazon UK         ██████████████       £450.00 (€527.50) 12.5%│
│  Awin              ████████████████████ €1,500.00   35.5%      │
│  LTK               ███                  $25.00 (€23.00)   0.5% │
│                                                                 │
│  Total Clicks: 12,450      Conversion Rate: 3.2%               │
└─────────────────────────────────────────────────────────────────┘
```

**How It Works (Backend)**:

API call: `GET /api/transactions/summary?start_date=2024-12-06&end_date=2025-01-06`

```typescript
// Backend calls helper function
const totalEarnings = await supabase.rpc('get_total_earnings', {
  p_user_id: userId,
  p_start_date: '2024-12-06',
  p_end_date: '2025-01-06'
});
// Returns: 4230.45 (SUM of commission_eur across all platforms)

// Get top storefronts
const topStorefronts = await supabase.rpc('get_top_storefronts', {
  p_user_id: userId,
  p_limit: 5
});
// Returns: [
//   { platform: 'amazon_de', storefront_name: 'My German Store', total_commission: 2100.00 },
//   { platform: 'awin', storefront_name: 'Awin Account', total_commission: 1500.00 },
//   ...
// ]
```

---

## 🔧 API Endpoints

### Connected Accounts

**GET /api/accounts**
- Lists all connected storefronts for user
- Returns: Array of connected_accounts

**POST /api/accounts**
```json
{
  "platform": "amazon_de",
  "storefront_name": "My German Amazon Store",
  "account_identifier": "myamazontag-21",
  "region": "DE"
}
```
- Creates new connection
- Returns: Created account with ID

**PUT /api/accounts/:id**
- Update storefront name or active status

**DELETE /api/accounts/:id**
- Remove storefront connection
- Cascade deletes transactions (RLS protected)

---

### Transactions

**GET /api/transactions**
Query params:
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD
- `platform`: Filter by platform (optional)
- `limit`: Number of results (default 100)

Returns: Array of transactions with normalized EUR amounts

**GET /api/transactions/summary**
Query params:
- `start_date`, `end_date`

Returns:
```json
{
  "summary": {
    "total_earnings": 4230.45,
    "growth_rate": 12.3,
    "breakdown": [
      {
        "platform": "amazon_de",
        "commission": 2100.00,
        "clicks": 5200,
        "orders": 180
      }
    ],
    "top_storefronts": [...]
  }
}
```

**POST /api/transactions/import**
```json
{
  "connected_account_id": "uuid",
  "platform": "amazon_de",
  "csv_data": "Date,Product,ASIN,Clicks,Orders,Shipped,Revenue,Earnings\n..."
}
```

Workflow:
1. Validates account belongs to user
2. Parses CSV using platform-specific parser
3. Converts currencies using ECB rates
4. Inserts transactions (skips duplicates)
5. Updates account sync_status
6. Returns: `{ imported_count: 47, skipped_count: 2 }`

---

## 📁 Backend Files Created

| File | Purpose |
|------|---------|
| [V2_MIGRATION_ADD_CREATOR_OPS.sql](V2_MIGRATION_ADD_CREATOR_OPS.sql) | Database schema for Phase 1 |
| [backend/src/api/accounts-routes.ts](backend/src/api/accounts-routes.ts) | CRUD for connected storefronts |
| [backend/src/api/transactions-routes.ts](backend/src/api/transactions-routes.ts) | Transactions API + CSV import |
| [backend/src/services/csv-importer.ts](backend/src/services/csv-importer.ts) | CSV parsing (Amazon, LTK formats) |
| [backend/src/services/currency-converter.ts](backend/src/services/currency-converter.ts) | Multi-currency normalization |
| [backend/src/api.ts](backend/src/api.ts) | Route registration |

---

## 🧪 Testing Locally

### 1. Run Migration in Supabase
```sql
-- Go to Supabase dashboard → SQL Editor
-- Run: V2_MIGRATION_ADD_CREATOR_OPS.sql
```

### 2. Start Backend
```bash
cd backend
npm run dev
# Runs on http://localhost:8787
```

### 3. Test Account Creation
```bash
curl -X POST http://localhost:8787/api/accounts \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -d '{
    "platform": "amazon_de",
    "storefront_name": "My German Store",
    "account_identifier": "myamazontag-21",
    "region": "DE"
  }'
```

### 4. Test CSV Import
```bash
# Sample Amazon DE CSV
cat > amazon_de_sample.csv << EOF
Date,Product,ASIN,Clicks,Ordered Items,Items Shipped,Revenue,Earnings
15.01.2025,Sony WH-1000XM5 Headphones,B09XYZ123,45,3,2,599.99,11.99
16.01.2025,Apple AirPods Pro,B08ABC456,120,5,5,1249.95,24.99
EOF

# Base64 encode
CSV_DATA=$(cat amazon_de_sample.csv | base64)

curl -X POST http://localhost:8787/api/transactions/import \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -d "{
    \"connected_account_id\": \"ACCOUNT_ID_FROM_STEP_3\",
    \"platform\": \"amazon_de\",
    \"csv_data\": \"$CSV_DATA\"
  }"
```

### 5. Test Summary Endpoint
```bash
curl http://localhost:8787/api/transactions/summary?start_date=2025-01-01&end_date=2025-01-31 \
  -H "x-user-id: YOUR_USER_ID"
```

---

## 🎨 Next: Frontend UI

Now that the backend is ready, we need to build:

1. **Storefronts Page** (`/dashboard/storefronts`)
   - List connected accounts
   - "Connect New Storefront" button
   - Upload CSV form

2. **Dashboard** (`/dashboard`)
   - Total earnings card (big number)
   - Growth rate indicator
   - Storefront breakdown chart
   - Recent transactions table

3. **Import Flow**
   - Platform selector (Amazon DE, Amazon UK, Awin, LTK, etc.)
   - CSV upload dropzone
   - Import progress indicator
   - Success/error messages

---

## 💡 Key Design Decisions

### Why CSV Upload First?

**Amazon API Problem**: Amazon Associates API requires significant sales history to get approved. Most creators don't have API access.

**Solution**: CSV upload is universal and works for ALL creators:
- Amazon: Download earnings report → Upload
- LTK: Export earnings → Upload
- Awin (later): OAuth when ready, CSV as fallback

### Why Normalize to EUR?

**Target Market**: EU-based creators (Germany, Netherlands, Lithuania, etc.)

**Reasoning**:
- ECB (European Central Bank) rates = EU compliance
- Most users will set EUR as home currency
- Easy to support other home currencies later (just change display, keep EUR storage)

### Why Unique Constraint on (user_id, platform, transaction_id, date)?

**Prevents Duplicates**: If user uploads same CSV twice, transactions are skipped instead of duplicated.

**Safe Re-imports**: User can re-upload to add missing transactions without fear.

---

## 🚀 What's Next?

**Status**: ✅ Phase 1 Backend Complete

**Pending**:
- [ ] Run SQL migration in Supabase (YOUR ACTION REQUIRED)
- [ ] Frontend UI implementation
- [ ] Test with real Amazon CSV exports

**When ready**: Proceed to Phase 2 (SmartWrappers + Link Health)

---

## 📝 User Story Examples

### Story 1: German Creator with Multi-Region Amazon

**Persona**: Lisa, German lifestyle blogger
- Audience: 60% DE, 30% UK, 10% US
- Has: Amazon DE tag, Amazon UK tag

**Flow**:
1. Lisa connects Amazon DE → Uploads CSV → Sees €2,100 earnings
2. Lisa connects Amazon UK → Uploads CSV → Sees £450 (€527.50) earnings
3. Dashboard shows: "€2,627.50 total this month"
4. Lisa can export for German tax (EÜR format) with one click (Phase 5)

### Story 2: Dutch Creator with LTK + Amazon

**Persona**: Sophie, Dutch fashion influencer
- Has: LTK account ($500/mo), Amazon NL (€300/mo)

**Flow**:
1. Sophie connects LTK → Uploads CSV → $500 = €460
2. Sophie connects Amazon NL → Uploads CSV → €300
3. Dashboard: "€760 total" + breakdown
4. Sophie sets home currency to EUR in preferences
5. Tax export uses Dutch ZZP persona (BTW format)

---

## 🔐 Security Notes

**Row Level Security (RLS)**:
- Users can ONLY see their own accounts and transactions
- Enforced at database level via Supabase policies

**API Authentication**:
- All endpoints require `x-user-id` header
- Frontend will use Supabase auth session token
- Backend validates via Supabase RLS

**Sensitive Data**:
- OAuth tokens encrypted at rest
- No credit card data stored
- CSV data stored in `raw_data` JSONB for audit trail only

---

## 📞 Support

**If you get errors**:
1. Check Supabase SQL logs for migration errors
2. Verify `profiles` table exists (required for foreign keys)
3. Run TypeScript check: `cd backend && npx tsc --noEmit`
4. Check console for detailed error messages

**Ready to test?** Run the SQL migration first, then start the backend!
