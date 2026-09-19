const FAL_KEY = process.env.FAL_KEY;

async function test() {
    console.log("Testing Nano Banana 2 Edit...");
    const res = await fetch('https://fal.run/fal-ai/nano-banana-2/edit', {
        method: 'POST',
        headers: {
            'Authorization': `Key ${FAL_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt: "Uma casa moderna",
            image_urls: ["https://raw.githubusercontent.com/CompVis/stable-diffusion/main/assets/stable-samples/img2img/sketch-mountains-input.jpg"],
            strength: 0.45,
            num_images: 1
        })
    });
    console.log("Status:", res.status);
    console.log("Response:", await res.text());
}

test();
