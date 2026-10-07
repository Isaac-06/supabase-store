import { supabase } from "../supabase";

function LogOut() {
	async function handleLogout() {
		if (!window.confirm("Are you sure you want to sign out?")) return;

		const { error } = await supabase.auth.signOut();
		if (error) console.error(error.message);
	}

	return <button type="button" onClick={handleLogout}>Sign out</button>;


}

export default LogOut;