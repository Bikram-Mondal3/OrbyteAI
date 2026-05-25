const response = await fetch("http://localhost:8000/v1/acd28cdd-b4fe-4a11-b3a6-f291729a22fd/chat", {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer sk_9VMsRCXWtb4M4OAW1KLgY0gkGNcqvJg0"
    },
    body: JSON.stringify({
        message: "can you send an email from bikrammondal5@agentmail.to to codesnippets45@gmail.com with msg Ts SDK working!!",
        session_id: "user-session-123"
    })
});
const data = await response.json();
console.log(data.message);