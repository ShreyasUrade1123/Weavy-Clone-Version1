import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/db';

// POST /api/workflows/[id]/duplicate - Duplicate workflow
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { clerkId: userId },
        });

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { id } = await params;

        // Get original workflow
        const original = await prisma.workflow.findFirst({
            where: {
                id,
                userId: user.id,
            },
        });

        if (!original) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        // Create duplicate
        const workflow = await prisma.workflow.create({
            data: {
                name: `${original.name} (Copy)`,
                description: original.description,
                nodes: original.nodes ?? [],
                edges: original.edges ?? [],
                userId: user.id,
            },
        });

        return NextResponse.json({ workflow }, { status: 201 });
    } catch (error) {
        console.error('Error duplicating workflow:', error);
        return NextResponse.json(
            { error: 'Failed to duplicate workflow' },
            { status: 500 }
        );
    }
}
