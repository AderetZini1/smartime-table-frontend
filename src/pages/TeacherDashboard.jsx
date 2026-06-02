import { useAuth } from '../context/AuthContext';

export default function TeacherDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <nav className="bg-teal-600 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Smartime — אזור אישי</h1>
        <div className="flex items-center gap-4">
          <span>שלום, {user?.first_name}</span>
          <button
            onClick={logout}
            className="bg-white text-teal-600 px-4 py-1 rounded-lg text-sm font-medium hover:bg-teal-50"
          >
            התנתק
          </button>
        </div>
      </nav>
      <div className="p-8">
        <h2 className="text-2xl font-bold text-gray-800">שלום, {user?.first_name}!</h2>
        <p className="text-gray-500 mt-2">כאן תוכל לנהל את ההעדפות שלך</p>
      </div>
    </div>
  );
}