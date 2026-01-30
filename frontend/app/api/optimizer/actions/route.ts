import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { analysis_id, action, switched_to_program_id } = await request.json() as {
      analysis_id: string;
      action: 'saved' | 'applied' | 'dismissed';
      switched_to_program_id?: string;
    };

    if (!analysis_id || !action) {
      return NextResponse.json({ error: 'analysis_id and action are required' }, { status: 400 });
    }

    if (!['saved', 'applied', 'dismissed'].includes(action)) {
      return NextResponse.json({ error: 'action must be saved, applied, or dismissed' }, { status: 400 });
    }

    // Map action to link_analyses status
    const statusMap: Record<string, string> = {
      saved: 'saved',
      applied: 'switched',
      dismissed: 'dismissed',
    };

    const updateData: Record<string, any> = {
      status: statusMap[action],
      updated_at: new Date().toISOString(),
    };

    if (action === 'applied') {
      updateData.switched_to_program_id = switched_to_program_id || null;
      updateData.switched_at = new Date().toISOString();
    }

    const { error } = await supabaseServer
      .from('link_analyses')
      .update(updateData)
      .eq('id', analysis_id)
      .eq('user_id', session.user.id);

    if (error) {
      console.error('[CommissionAgent] Action update error:', error);
      return NextResponse.json({ error: 'Failed to update action' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[CommissionAgent] Action error:', error);
    return NextResponse.json(
      { error: 'Failed to process action. Please try again.' },
      { status: 500 }
    );
  }
}
