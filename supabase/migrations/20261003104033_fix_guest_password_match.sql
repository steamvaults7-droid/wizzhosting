/*
# Fix guest account password to match app code

The signInAsGuest function uses 'GuestCubeForge2026!' as the password.
Update the auth user's encrypted_password to match.
*/

UPDATE auth.users
SET encrypted_password = crypt('GuestCubeForge2026!', gen_salt('bf'))
WHERE email = 'guest@cubeforge.local';
