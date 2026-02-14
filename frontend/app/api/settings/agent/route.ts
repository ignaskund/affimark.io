import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase-server';

// ============================================================
// Types
// ============================================================

interface AgentSettings {
    matchType: 'exact' | 'similar' | 'both';
    minPartnershipScore: number;
    includeUnverifiedBrands: boolean;
    preferredNetworks: string[];
    autoRefreshReputation: boolean;
    cacheExpiryDays: number;
}

const DEFAULT_SETTINGS: AgentSettings = {
    matchType: 'both',
    minPartnershipScore: 50,
    includeUnverifiedBrands: true,
    preferredNetworks: [],
    autoRefreshReputation: true,
    cacheExpiryDays: 7,
};

// ============================================================
// GET /api/settings/agent - Fetch user's agent settings
// ============================================================

export async function GET() {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = await createSupabaseServerClient();

        const { data, error } = await supabase
            .from('user_creator_preferences')
            .select('agent_settings')
            .eq('user_id', session.user.id)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error fetching agent settings:', error);
            return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
        }

        // Return stored settings or defaults
        const settings = data?.agent_settings || DEFAULT_SETTINGS;

        return NextResponse.json({
            success: true,
            settings,
        });
    } catch (error) {
        console.error('Agent settings GET error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// ============================================================
// POST /api/settings/agent - Save user's agent settings
// ============================================================

export async function POST(request: NextRequest) {
    const session = await auth();

    if (!session?.user?.id) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { settings } = body as { settings: AgentSettings };

        if (!settings) {
            return NextResponse.json({ error: 'Settings required' }, { status: 400 });
        }

        // Validate settings
        if (!['exact', 'similar', 'both'].includes(settings.matchType)) {
            return NextResponse.json({ error: 'Invalid matchType' }, { status: 400 });
        }

        if (settings.minPartnershipScore < 0 || settings.minPartnershipScore > 100) {
            return NextResponse.json({ error: 'minPartnershipScore must be 0-100' }, { status: 400 });
        }

        if (settings.cacheExpiryDays < 1 || settings.cacheExpiryDays > 30) {
            return NextResponse.json({ error: 'cacheExpiryDays must be 1-30' }, { status: 400 });
        }

        const supabase = await createSupabaseServerClient();

        // Upsert settings into user_creator_preferences
        const { error } = await supabase
            .from('user_creator_preferences')
            .upsert({
                user_id: session.user.id,
                agent_settings: settings,
                updated_at: new Date().toISOString(),
            }, {
                onConflict: 'user_id',
            });

        if (error) {
            console.error('Error saving agent settings:', error);
            return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            message: 'Settings saved successfully',
        });
    } catch (error) {
        console.error('Agent settings POST error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
