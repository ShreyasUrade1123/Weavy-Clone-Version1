import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Define routes that should be public
const isPublicRoute = createRouteMatcher([
    '/sign-in(.*)',
    '/sign-up(.*)',
    '/api/upload/params',
    '/api/webhooks(.*)',
    '/api/process(.*)', // Transloadit callbacks might need to be public or handled specifically
    '/' // Landing page
]);

export default clerkMiddleware(async (auth, req) => {
    console.log("Middleware hitting:", req.url);
    if (!isPublicRoute(req)) {
        const { userId, redirectToSignIn } = await auth();
        if (!userId) {
            return redirectToSignIn();
        }
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
