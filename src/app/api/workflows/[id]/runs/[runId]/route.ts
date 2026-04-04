import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

interface RouteParams {
    params: Promise<{ id: string; runId: string }>;
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { userId } = await auth();
        const { id, runId } = await params;

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify the run belongs to this user and workflow
        const run = await prisma.workflowRun.findFirst({
            where: {
                id: runId,
                workflowId: id,
                userId: user.id
            }
        });

        if (!run) {
            return NextResponse.json({ error: 'Run not found' }, { status: 404 });
        }

        await prisma.workflowRun.delete({
            where: { id: run.id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete run:', error);
        return NextResponse.json(
            { error: 'Failed to delete run' },
            { status: 500 }
        );
    }
}
