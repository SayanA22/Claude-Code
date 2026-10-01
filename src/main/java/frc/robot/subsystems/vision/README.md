# Vision (PhotonVision + AdvantageKit)

| File | Purpose |
|---|---|
| `VisionConstants.java` | Camera names, camera mounting position, filtering thresholds |
| `VisionIO.java` | Logged inputs (what the camera saw) |
| `VisionIOPhotonVision.java` | Real camera: reads `getAllUnreadResults()` and turns tags into robot poses |
| `VisionIOPhotonVisionSim.java` | Simulated camera, so you can test with no hardware |
| `Vision.java` | Subsystem: filters bad poses and sends good ones to the drive pose estimator |

## Wiring in RobotContainer

```java
private final Vision vision;

// inside the constructor, in the switch (Constants.currentMode)
case REAL:
  vision = new Vision(
      drive::addVisionMeasurement,
      new VisionIOPhotonVision(VisionConstants.camera0Name, VisionConstants.robotToCamera0));
  break;

case SIM:
  vision = new Vision(
      drive::addVisionMeasurement,
      new VisionIOPhotonVisionSim(
          VisionConstants.camera0Name, VisionConstants.robotToCamera0, drive::getPose));
  break;

default: // REPLAY
  vision = new Vision(drive::addVisionMeasurement, new VisionIO() {});
  break;
```

`drive` must have:

```java
public void addVisionMeasurement(
    Pose2d visionRobotPoseMeters, double timestampSeconds, Matrix<N3, N1> visionMeasurementStdDevs) {
  poseEstimator.addVisionMeasurement(
      visionRobotPoseMeters, timestampSeconds, visionMeasurementStdDevs);
}
```

The AdvantageKit swerve template already includes this method.

## Before a camera arrives

1. Install the PhotonLib vendordep (WPILib: *Manage Vendor Libraries → Install new library (online)*).
2. Set `Constants.currentMode` to `SIM` and run **Simulate Robot Code**.
3. Open AdvantageScope and add `Vision/Summary/RobotPosesAccepted` to a 3D field view.
   As you drive, the simulated camera sees tags and the poses show up.

## When the camera arrives

- Set the camera nickname in the PhotonVision UI so it matches `camera0Name`.
- Calibrate the camera, and set the pipeline to AprilTag with 3D mode and multi-tag turned on.
- Measure `robotToCamera0` on the robot. This is the most common cause of wrong poses.
