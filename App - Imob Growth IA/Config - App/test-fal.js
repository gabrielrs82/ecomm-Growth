

async function testFAL() {
    const FAL_KEY = process.env.FAL_KEY;
    if (!FAL_KEY) {
        console.error("FAL_KEY not found in .env");
        return;
    }

    console.log("Testing FAL.ai API with 1 image...");
    let falResponse = await fetch('https://fal.run/fal-ai/flux/dev', {
        method: 'POST',
        headers: {
            'Authorization': `Key ${FAL_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt: "A modern house",
            image_size: { width: 1080, height: 1080 },
            num_inference_steps: 20,
            guidance_scale: 3.5,
            num_images: 1,
            enable_safety_checker: true
        })
    });

    if (!falResponse.ok) {
        const text = await falResponse.text();
        console.error("FAL error (1 image):", text);
    } else {
        console.log("FAL success (1 image):", await falResponse.json());
    }

    console.log("\nTesting FAL.ai API with 3 images...");
    falResponse = await fetch('https://fal.run/fal-ai/flux/dev', {
        method: 'POST',
        headers: {
            'Authorization': `Key ${FAL_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            prompt: "A modern house",
            image_size: { width: 1080, height: 1080 },
            num_inference_steps: 20,
            guidance_scale: 3.5,
            num_images: 3,
            enable_safety_checker: true
        })
    });

    if (!falResponse.ok) {
        const text = await falResponse.text();
        console.error("FAL error (3 images):", text);
    } else {
        console.log("FAL success (3 images):", await falResponse.json());
    }
}

testFAL();
