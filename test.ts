import fs from "fs";

const prompt = encodeURIComponent(
    "A car flying in the sky with a rainbow in the background, in the style of a Pixar animation"
);

async function generateVideo() {
    try {
        const response = await fetch(
            `https://gen.pollinations.ai/video/${prompt}?model=ltx-2`,
            {
                method: "GET",
                headers: {
                    Authorization: "Bearer sk_EiSJCRT3UqfNGX6oAG2ml8R6b7eWBlPZ",
                },
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const blob = await response.blob();

        const buffer = Buffer.from(await blob.arrayBuffer());

        fs.writeFileSync("video.mp4", buffer);

        console.log("✅ Video saved as video.mp4");
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

generateVideo();