# NetBridge Gateway Helper

## Start (recommended)

Double-click `start_agent.bat` and allow Administrator permission.

## Friend join link (works without internet on their phone)

After you start sharing, friends should:

1. Join your shared WiFi  
2. Open the join link shown in your dashboard (example: `http://192.168.137.1:8765/join`)  
3. Log in / sign up and enter your invite code  

That page is served by **this computer**, so it loads even when the phone has no internet yet.

## First-time setup on this PC

```powershell
cd frontend
npm install
npm run build
```

Then start the helper again.
