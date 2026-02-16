import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { z } from 'zod';

const updateWorkflowSchema = z.object({
    name: z.string().optional(),
    nodes: z.array(z.any()).optional(),
    edges: z.array(z.any()).optional(),
});

export async function GET(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;
        console.log(`[API] GET /api/workflows/${params.id}`);

        const { userId: clerkId } = await auth();
        console.log(`[API] Auth clerkId: ${clerkId}`);

        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Look up the internal user by Clerk ID
        const user = await prisma.user.findUnique({ where: { clerkId } });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const workflow = await prisma.workflow.findFirst({
            where: {
                id: params.id,
                userId: user.id,
            },
        });

        if (!workflow) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        return NextResponse.json({ workflow });
    } catch (error) {
        console.error('Failed to fetch workflow:', error);
        return NextResponse.json(
            { error: 'Failed to fetch workflow' },
            { status: 500 }
        );
    }
}

async function handleUpdate(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;

        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Look up the internal user by Clerk ID
        const user = await prisma.user.findUnique({ where: { clerkId } });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const body = await request.json();
        const validation = updateWorkflowSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                { error: 'Invalid input', details: validation.error.flatten() },
                { status: 400 }
            );
        }

        const { name, nodes, edges } = validation.data;

        // Verify ownership first
        const existing = await prisma.workflow.findFirst({
            where: { id: params.id, userId: user.id },
        });
        if (!existing) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        // Construct update data
        const updateData: Record<string, unknown> = {};
        if (name) updateData.name = name;
        if (nodes) updateData.nodes = nodes;
        if (edges) updateData.edges = edges;

        const workflow = await prisma.workflow.update({
            where: { id: params.id },
            data: updateData,
        });

        return NextResponse.json({ workflow });
    } catch (error) {
        console.error('Failed to update workflow:', error);
        return NextResponse.json(
            { error: 'Failed to update workflow' },
            { status: 500 }
        );
    }
}

// Support both PUT and PATCH (the store uses PATCH)
export const PUT = handleUpdate;
export const PATCH = handleUpdate;

export async function DELETE(
    request: NextRequest,
    props: { params: Promise<{ id: string }> }
) {
    try {
        const params = await props.params;

        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({ where: { clerkId } });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Verify ownership
        const existing = await prisma.workflow.findFirst({
            where: { id: params.id, userId: user.id },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        await prisma.workflow.delete({
            where: { id: params.id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Failed to delete workflow:', error);
        return NextResponse.json(
            { error: 'Failed to delete workflow' },
            { status: 500 }
        );
    }
}
