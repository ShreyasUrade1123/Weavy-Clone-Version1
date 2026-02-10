
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  try {
    const wf = await prisma.workflow.findFirst({
      where: { name: { contains: 'Demo' } },
      select: { id: true, name: true, nodes: true }
    });

    if (wf) {
      const nodes = JSON.parse(JSON.stringify(wf.nodes));
      const output = nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        label: n.data?.label,
        videoUrl: n.data?.videoUrl,
        imageUrl: n.data?.imageUrl
      }));
      fs.writeFileSync('workflow_nodes.json', JSON.stringify(output, null, 2));
      console.log('WORKFLOW_SAVED');
    } else {
      console.log('WORKFLOW_NOT_FOUND');
    }
  } catch (e) {
    console.error(e);
  } finally {
    await prisma.$disconnect();
  }
}

main();
