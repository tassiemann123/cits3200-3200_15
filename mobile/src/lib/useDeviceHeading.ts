/** FILE DEVELOPED FOR THE UWA CITS3200 PROFESSIONAL COMPUTING PROJECT
 * AS UNDERTAKEN BY GROUP 15:
 * HOGAN TAN, IVY QI, SUHRID MAHMOOD PUSHAN, TASVEER MANN, WENBO ZHONG,
 * RUAN VAN ZYL
 *
 * File Function:
 * React hook providing the device's live compass heading and GPS location
 * (with their accuracy) for the CompassIndicator, using the plugins
 * @capawesome/capacitor-compass (heading) and @capacitor/geolocation (GPS).
 * The compass needs no permission (Android's built-in magnetic heading);
 * GPS asks for location permission at run time.
 */


/* Imports */
import { useEffect, useState } from "react";
import { Compass } from "@capawesome/capacitor-compass";
import { Geolocation, type Position } from "@capacitor/geolocation";

/* Interfaces */
export interface DeviceHeadingState {
    /** Magnetic north heading using 0-360 degrees and Null until the first reading */
    heading: number | null;
    
    /** Max deviation between the recorded magnetic and true heading in degrees (for accuracy value),
     * If unknown return Null
     */
    headingAccuracy: number | null;

    /** GPS latitude */
    latitude: number | null;

    /** GPS longitude */
    longitude: number | null;

    /** GPS accuracy */
    gpsAccuracy: number | null;

    /** String to store any errors that appear for displaying */
    errorMessage: string | null;
}

/** Initialise the state as null on all terms */
const INITIAL_STATE: DeviceHeadingState = {
    heading: null,
    headingAccuracy: null,
    latitude: null,
    longitude: null,
    gpsAccuracy: null,
    errorMessage: null,
};

/** Using export as this is a purely functional file and we will call this from the android build */
export function useDeviceHeading(): DeviceHeadingState {
    const [state, setState] = useState<DeviceHeadingState>(INITIAL_STATE);

    useEffect(() => {
        // We want to set up some guarding for any setStates after a component has become unmounted
        let cancelled = false;
        let compassHandle: { remove: () => Promise<void> } | null = null;
        let gpsWatchId: string | null = null;

        // Compass Function - we use async functions from ts to allow the code to run asynchronously between the compass and gps
        async function startCompass() {
            try {
                // For safety as we dont yet have a guarentee on the exact devices and hardware available on site so we first try using the builtin available check
                const { available } = await Compass.isAvailable();
                if (!available) {
                    if (!cancelled) {
                        setState((prev) => ({ ...prev, errorMessage:"No compass hardware on this device available" }));
                    }
                    return;
                }
                
                // We have the necessary hardware so we must now start updates
                // Use the React prev variable which uses the immediately previous version before we do any state changes to avoid any timing inconsistencies between GPS
                // and the compass updates
                compassHandle = await Compass.addListener("headingChange", (heading) => {
                    if (cancelled) return;
                    setState((prev) => ({
                        ...prev,
                        heading: heading.magneticHeading,
                        headingAccuracy: heading.accuracy,
                    }));
                });

                await Compass.startHeadingUpdates();
            
            // If we find an error beyond hardware availability we should pass it up and out for display
            } catch (err) {
                if (!cancelled) {
                    setState((prev) => ({ ...prev, errorMessage:`Compass error: ${String(err)}` }));
                }
            }
        }

        // GPS function
        async function startGps() {
            try {
                // Requirements for the gps to work is a permission check sent to the user - ensure we report this requirement to client/users
                const permission = await Geolocation.checkPermissions();
                let granted = permission.location === "granted";
                
                if (!granted) {
                    const requested = await Geolocation.requestPermissions();
                    granted = requested.location === "granted";
                }

                if (!granted) {
                    if (!cancelled) {
                        setState((prev) => ({ ...prev, errorMessage:"Location permission denied - required for features usage"}));
                    }
                    return;
                }

                gpsWatchId = await Geolocation.watchPosition(
                    { enableHighAccuracy: true },
                    (position: Position | null, err) => {
                        if (cancelled) return;
                        if (err) {
                            setState((prev) => ({ ...prev, errorMessage:`GPS error: ${String(err)}` }));
                            return;
                        }
                        if (position) {
                            setState((prev) => ({
                                ...prev,
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                gpsAccuracy: position.coords.accuracy,
                            }));
                        }
                    }
                );

            // If we find an error beyond location permissions we should pass it up and out for display
            } catch (err) {
                if (!cancelled) {
                    setState((prev) => ({ ...prev, errorMessage:'GPS error: ${String(err)}'}));
                }
            }
        }

        // Turn the features on
        startCompass();
        startGps();

        return () => {
            cancelled = true;
            compassHandle?.remove();
            Compass.stopHeadingUpdates().catch(() => {});
            if (gpsWatchId) {
                Geolocation.clearWatch({ id: gpsWatchId }).catch(() => {});
            }
        };
    }, []);
    
return state;
}