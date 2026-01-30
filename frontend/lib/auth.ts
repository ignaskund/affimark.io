import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

export async function auth() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return null;
    }

    return {
      user: {
        id: (session.user as any).id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
      },
    };
  } catch (error) {
    console.error('Auth error:', error);
    return null;
  }
}

