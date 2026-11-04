const brevoApiKey = Deno.env.get("BREVO_API_KEY")

Deno.serve(async (req) => {
  try {
    const { email, otp } = await req.json()

    const response = await fetch(
      "https://api.brevo.com/v3/smtp/email",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-key": brevoApiKey!,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: {
            name: "NeonCart",
            email: "isaacmokwenye06@gmail.com",
          },
          to: [
            {
              email,
            },
          ],
          subject: "NeonCart Verification Code",
          htmlContent: `
            <h2>Verification Code</h2>
            <p>Your OTP is:</p>
            <h1>${otp}</h1>
            <p>This code will expire in 10 minutes.</p>
          `,
        }),
      }
    )

    const data = await response.json()

    return new Response(
      JSON.stringify(data),
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error
          ? error.message
          : "Unknown error",
      }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
        },
      }
    )
  }
})