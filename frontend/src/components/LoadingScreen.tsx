import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-a2-bg text-white">
      <div className="text-center">
        <motion.div
          animate={{ scale: [1, 1.04, 1], boxShadow: ["0 0 0 rgba(183,254,26,0)", "0 0 42px rgba(183,254,26,0.36)", "0 0 0 rgba(183,254,26,0)"] }}
          transition={{ duration: 1.8, repeat: Infinity }}
          className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-xl bg-a2-green text-2xl font-black text-black"
        >
          <img src="/assets/a2-logo.png" alt="" className="h-full w-full object-cover" />
        </motion.div>
        <h1 className="mt-5 text-2xl font-black">A2 Panel</h1>
        <p className="mt-2 text-sm text-zinc-500">Loading secure staff session</p>
      </div>
    </div>
  );
}
