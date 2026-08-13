import type { Metadata } from "next";
import "./tracking.css";

export const metadata: Metadata={title:"Repair status · RepairTrace",robots:{index:false,follow:false},referrer:"no-referrer"};

export default function TrackingLayout({children}:{children:React.ReactNode}) { return children; }
