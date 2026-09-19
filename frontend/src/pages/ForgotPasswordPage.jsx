import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <PageHeader
        title="Forgot password"
        subtitle="Password resets are handled by your system administrator. Contact the Accounts Department ICT focal person."
      />
      <Link to="/login" className="ams-btn-primary w-fit">
        Return to sign in
      </Link>
    </div>
  );
}
