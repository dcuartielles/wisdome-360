// =====================================================================
// EX-06  DomePlacement.cs   --   Unity
// =====================================================================
// Place objects on a dome by ANGLE instead of by position, and see the
// comfortable zone and the sweet spot in the Scene view while you work.
//
// Drop this on any GameObject. Set Azimuth and Elevation. That is it.
//
// Why bother: a dome audience perceives your scene as directions, not as
// coordinates. The comfortable zone is a patch IN FRONT of the audience --
// 15 to 60 degrees above eye level, +-60 degrees either side of the front --
// with the sweet spot straight ahead at 40 degrees up. Behind and far to the
// sides is ambience: nobody turns round for it. All of that is invisible if
// you are dragging transforms around in XYZ.
//
// Unity is Y-up and left-handed. Here (the ROOM, as the audience sits in it):
//      +Y  = up
//      -Z  = the FRONT of the room, i.e. azimuth 0
//      +X  = to the audience's right, i.e. azimuth +90
//
// Wisdome Malmo is tilted 26 degrees, raised at the back. Tilt the Dome
// Creator rig to match (its zenith leaning 26 degrees towards -Z) and keep
// the world level, so these room angles are what the audience sees.
// =====================================================================
using UnityEngine;

[ExecuteAlways]
[AddComponentMenu("Dome/Dome Placement")]
public class DomePlacement : MonoBehaviour
{
    [Header("Where on the dome")]
    [Tooltip("0 = front of the room. Positive turns to the audience's right.")]
    [Range(-180f, 180f)] public float azimuth = 0f;

    [Tooltip("0 = eye level, 90 = straight up. Comfortable: 15 to 60, in front.")]
    [Range(-20f, 90f)] public float elevation = 40f;

    [Min(0.1f)] public float distance = 15f;

    [Header("Behaviour")]
    [Tooltip("Clamp this object into the comfortable zone in front, so it cannot " +
             "drift overhead, behind the seat backs, or round behind the audience. " +
             "Turn it off for ambience that wraps the whole dome.")]
    public bool clampToComfortableZone = true;
    public float zoneLow  = 15f;     // degrees above eye level
    public float zoneHigh = 60f;
    public float zoneAzimuth = 60f;  // +- degrees either side of the front

    [Tooltip("Turn the object to face the dome centre, where the audience is.")]
    public bool faceAudience = true;

    [Header("Drift (degrees of azimuth per second)")]
    [Tooltip("Keep this small. Fast rotation around a dome audience is a " +
             "reliable way to make them ill.")]
    [Range(-10f, 10f)] public float azimuthDrift = 0f;

    public const float ZoneLowDefault     = 15f;
    public const float ZoneHighDefault    = 60f;
    public const float ZoneAzimuthDefault = 60f;
    public const float SweetSpotElevation = 40f;   // straight ahead
    public const float SweetSpotRadius    = 12f;

    /// <summary>(azimuth, elevation, distance) -> a position in the room.</summary>
    public static Vector3 ToPosition(float azDeg, float elevDeg, float dist)
    {
        float a = azDeg * Mathf.Deg2Rad;
        float e = elevDeg * Mathf.Deg2Rad;
        return new Vector3(
            dist * Mathf.Cos(e) * Mathf.Sin(a),   //  X : right
            dist * Mathf.Sin(e),                  //  Y : up
           -dist * Mathf.Cos(e) * Mathf.Cos(a));  // -Z : front
    }

    /// <summary>A position in the room -> (azimuth, elevation, distance).</summary>
    public static void FromPosition(Vector3 p, out float azDeg, out float elevDeg, out float dist)
    {
        dist    = p.magnitude;
        elevDeg = dist < 1e-4f ? 0f : Mathf.Asin(Mathf.Clamp(p.y / dist, -1f, 1f)) * Mathf.Rad2Deg;
        azDeg   = Mathf.Atan2(p.x, -p.z) * Mathf.Rad2Deg;
    }

    void Update()
    {
        if (Application.isPlaying && !Mathf.Approximately(azimuthDrift, 0f))
            azimuth = Mathf.Repeat(azimuth + azimuthDrift * Time.deltaTime + 180f, 360f) - 180f;

        float a = azimuth, e = elevation;
        if (clampToComfortableZone)
        {
            a = Mathf.Clamp(a, -zoneAzimuth, zoneAzimuth);
            e = Mathf.Clamp(e, zoneLow, zoneHigh);
        }
        transform.position = ToPosition(a, e, distance);

        if (faceAudience)
            transform.rotation = Quaternion.LookRotation(-transform.position.normalized, Vector3.up);
    }

#if UNITY_EDITOR
    void OnDrawGizmosSelected()
    {
        // the comfortable zone: a patch in front, not a ring round the room
        Gizmos.color = new Color(0.35f, 0.95f, 0.55f, 0.9f);
        DrawArc(-zoneAzimuth, zoneAzimuth, zoneLow,  zoneLow);
        DrawArc(zoneAzimuth,  zoneAzimuth, zoneLow,  zoneHigh);
        DrawArc(zoneAzimuth, -zoneAzimuth, zoneHigh, zoneHigh);
        DrawArc(-zoneAzimuth, -zoneAzimuth, zoneHigh, zoneLow);

        // the sweet spot: straight ahead, 40 degrees up
        Gizmos.color = new Color(1f, 0.85f, 0.30f, 0.95f);
        DrawSweetSpot();

        // eye level, all the way round
        Gizmos.color = new Color(0.5f, 0.6f, 0.75f, 0.35f);
        DrawArc(-180f, 180f, 0f, 0f);

        // the front of the room
        Gizmos.color = new Color(1f, 0.49f, 0.30f, 1f);
        Gizmos.DrawLine(Vector3.zero, ToPosition(0f, 2f, distance));

        Gizmos.color = Color.white;
        Gizmos.DrawLine(Vector3.zero, transform.position);
    }

    // a line from (az0, el0) to (az1, el1), walked in angle so it bends with the dome
    void DrawArc(float az0, float az1, float el0, float el1, int steps = 48)
    {
        Vector3 prev = ToPosition(az0, el0, distance);
        for (int i = 1; i <= steps; i++)
        {
            float t = i / (float)steps;
            Vector3 cur = ToPosition(Mathf.Lerp(az0, az1, t), Mathf.Lerp(el0, el1, t), distance);
            Gizmos.DrawLine(prev, cur);
            prev = cur;
        }
    }

    void DrawSweetSpot()
    {
        Vector3 c = ToPosition(0f, SweetSpotElevation, 1f);
        Vector3 u = Vector3.right;
        Vector3 v = Vector3.Cross(c, u).normalized;
        float r = SweetSpotRadius * Mathf.Deg2Rad;
        Vector3 prev = Vector3.zero;
        for (int i = 0; i <= 64; i++)
        {
            float f = i / 64f * Mathf.PI * 2f;
            Vector3 d = c * Mathf.Cos(r) + (u * Mathf.Cos(f) + v * Mathf.Sin(f)) * Mathf.Sin(r);
            Vector3 cur = d * distance;
            if (i > 0) Gizmos.DrawLine(prev, cur);
            prev = cur;
        }
    }
#endif
}
