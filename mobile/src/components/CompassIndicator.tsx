/**
 * CompassIndicator.tsx file for the circular compass on the android application main page
 * Design goal is a circle with a red arrow/line indicator for magnetic north as detected in the
 * useDeviceHeading.ts file, the circle will then have touch interaction to open a further location
 * panel for the GPS coordinates and heading+GPS accuracy
 * 
 * Styling will be done to match the darker view style chosen by other team for the main page
 */

import { useState } from "react";
import { Navigation } from "lucide-react";
import { useDeviceHeading } from "../lib/useDeviceHeading";

/** ASCII code is for the degrees symbol which is for the valueIfTrue
* Formatting of the degrees value with units in degrees or "-" if there is not a value given (null),
* should not require any decimal points of accuracy
*/
function formatDegrees(value: number | null): string {
    return value === null ? "-" : `${value.toFixed(0)}\u00B0`;
}

/** formatting of the accuracies, units varying so set as a variable, if not given (null) or negative 
* (some calculation fault) then unknown, give a decimal point for better result resolution
* 
* After doing some testing it was found that the compass heading accuracy value would not change as expected and stayed
* at zero, which is unexpected and we do not want to feed the client misinformation about its accuracy, so added a treatZeroAsUnavailable 
* variable and addition if statement - FLAG FURTHER RESEARCH INTO ISSUE OR SWITCHING PLUGIN USED MAY BE REQUIRED
*/
function formatAccuracy(value: number | null, unit: string, treatZeroAsUnavailable = false): string {
    if (value === null || value < 0) return "unknown";
    if (treatZeroAsUnavailable && value === 0) return "not available";
    return `+-${value.toFixed(1)}${unit}`;
}

/** GPS coordinates formatting, no units attached, given large accuracy of 5 decimals as small movements
* do not cause much coordinate change
*/
function formatCoordinate(value: number | null): string {
    return value === null ? "-" : value.toFixed(5);
}

/** Main function for the compass GUI element */
export function CompassIndicator() {
    const { heading, headingAccuracy, latitude, longitude, gpsAccuracy, errorMessage } =
        useDeviceHeading();
    const [expanded, setExpanded] = useState(false);

    // Compass needle should always point north so a left rotation of the phone +90deg should result in
    // a heading change on -90deg
    const needleRotation = heading === null ? 0 : -heading;

    // Colour for the needle chosen as a strong red colour - can replace with any other colour if client requests
    return (
        <div className="compass-indicator">
            <button
                type="button"
                className="compass-dial"
                onClick={() => setExpanded((value) => !value)}
                title="Compass Heading"
            >
                <Navigation
                    size={28}
                    strokeWidth={2.5}
                    color="#e63946"
                    style={{ transform: `rotate(${needleRotation}deg)`, transition: "transform 0.15s ease-out"}}
                />
            </button>
            {expanded && (
                <div className="compass-details-popout">
                    <div className="compass-details-row">
                        <span>Heading</span>
                        <strong>{formatDegrees(heading)}</strong>
                    </div>
                    <div className="compass-details-row">
                        <span>Heading Accuracy</span>
                        <strong>{formatAccuracy(headingAccuracy, "\u00B0", true)}</strong>
                    </div>
                    <div className="compass-details-row">
                        <span>Latitude</span>
                        <strong>{formatCoordinate(latitude)}</strong>
                    </div>
                    <div className="compass-details-row">
                        <span>Longitude</span>
                        <strong>{formatCoordinate(longitude)}</strong>
                    </div>
                    <div className="compass-details-row">
                        <span>GPS Accuracy</span>
                        <strong>{formatAccuracy(gpsAccuracy, "m")}</strong>
                    </div>
                    {errorMessage && <p className="compass-details-error">{errorMessage}</p>}
                </div>
            )}
        </div>
    );
}