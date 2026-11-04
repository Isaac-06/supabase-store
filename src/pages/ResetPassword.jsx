import { useCallback, useEffect } from "react";

function ResetPassword() {
  const generateOtp = useCallback(() => {
    const otp = Math.floor(
      100000 + Math.random() * 900000
    ).toString();

    console.log(otp);
  }, []);

  useEffect(() => {
    generateOtp();
  }, [generateOtp]);

  return (
    <div>
      Reset Password
    </div>
  );
}

export default ResetPassword;