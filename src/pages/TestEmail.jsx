import { supabase } from "../supabase"

export default function TestEmail() {
  const sendTest = async () => {
    const { data, error } = await supabase.functions.invoke(
      "send-password-otp",
      {
        body: {
          email: "isaacmokwenye06@gmail.com",
          otp: "123456",
        },
      }
    )

    console.log(data)
    console.log(error)
  }

  return (
    <div>
      <button onClick={sendTest}>
        Send Test OTP
      </button>
    </div>
  )
}