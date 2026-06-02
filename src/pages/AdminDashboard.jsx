import { useAuth } from '../context/AuthContext';

export default function AdminDashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <nav className="bg-indigo-700 text-white px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold">Smartime — דשבורד מנהל</h1>
        <div className="flex items-center gap-4">
          <span>שלום, {user?.first_name}</span>
          <button
            onClick={logout}
            className="bg-white text-indigo-700 px-4 py-1 rounded-lg text-sm font-medium hover:bg-indigo-50"
          >
            התנתק
          </button>
        </div>
      </nav>
      <div className="p-8">
        <h2 className="text-2xl font-bold text-gray-800">ברוך הבא, {user?.first_name}!</h2>
        <p className="text-gray-500 mt-2">כאן תנהל את מערכת השעות</p>
      </div>
    </div>
  );
}