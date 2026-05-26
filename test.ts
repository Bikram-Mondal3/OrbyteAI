import fs from "fs";

const prompt = encodeURIComponent(
    "A car"
);

async function generateImage() {
    try {
        const response = await fetch(
            `https://gen.pollinations.ai/image/${prompt}?model=klein`,
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

        fs.writeFileSync("photo.png", buffer);

        console.log("✅ Image saved as photo.png");
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

generateImage();