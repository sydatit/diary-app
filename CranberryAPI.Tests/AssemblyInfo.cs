using Xunit;

// .NET 6 minimal hosting finds the app's host through a process-wide listener, so several
// WebApplicationFactory<Program> instances starting at once can pick up each other's host.
// The suite takes a few seconds, so run the test classes one after another.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
