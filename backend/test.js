import Groq from "groq-sdk";

console.log("TEST FILE STARTED"); // 👈 debug

const groq = new Groq({
    apiKey: "PASTE_YOUR_NEW_KEY_HERE", // ⚠️ put fresh key
});

const run = async () => {
    try {
        const res = await groq.chat.completions.create({
            model: "llama3-8b-8192",
            messages: [
                { role: "user", content: "Hello" }
            ],
        });

        console.log("AI RESPONSE:");
        console.log(res.choices[0].message.content);

    } catch (err) {
        console.error("ERROR:", err);
    }
};

run();