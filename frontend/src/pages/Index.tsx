import { AuthScreen } from "@/components/koru/AuthScreen";
import { KoruApp } from "@/components/koru/KoruApp";
import { useAuth } from "@/hooks/useAuth";

const Index = () => {
  const { user, loading, signUp, signIn, resetPassword, signOut } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="text-xl text-muted-foreground">Preparing Koru...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen onSignUp={signUp} onSignIn={signIn} onResetPassword={resetPassword} />;
  }

  return <KoruApp userId={user.id} onSignOut={signOut} />;
};

export default Index;
